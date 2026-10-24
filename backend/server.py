"""
DataViz Pro - Python Backend Server
Handles MySQL connection, EDA, data cleaning, and Gemini AI integration.
"""

import os
import io
import json
import traceback
import decimal
from flask import Flask, request, jsonify
from flask_cors import CORS
import pymysql
import pandas as pd
import numpy as np
from dotenv import load_dotenv
from sqlalchemy import create_engine
from urllib.parse import quote_plus
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from werkzeug.utils import secure_filename

load_dotenv()

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max request
CORS(app)

# ============================================================
# Gemini AI Setup
# ============================================================
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
genai = None
model = None

if GEMINI_API_KEY and GEMINI_API_KEY != 'your_gemini_api_key_here':
    try:
        import google.generativeai as genai_module
        genai_module.configure(api_key=GEMINI_API_KEY)
        genai = genai_module
        model = genai.GenerativeModel('gemini-2.0-flash')
        print("[OK] Gemini AI initialized successfully")
    except Exception as e:
        print(f"[WARN] Gemini AI init failed: {e}")
else:
    print("[WARN] No Gemini API key found. AI features will use fallback mode.")


def ask_gemini(prompt):
    """Send a prompt to Gemini and return the response text."""
    if model:
        try:
            response = model.generate_content(prompt)
            return response.text
        except Exception as e:
            print(f"Gemini error: {e}")
            return None
    return None


# ============================================================
# Database Connection
# ============================================================
@app.route('/api/connect', methods=['POST'])
def connect_db():
    """Test MySQL connection and return list of tables."""
    try:
        data = request.json
        conn = pymysql.connect(
            host=data.get('host', 'localhost'),
            port=int(data.get('port', 3306)),
            user=data.get('user', 'root'),
            password=data.get('password', ''),
            database=data.get('database', ''),
            connect_timeout=10
        )
        cursor = conn.cursor()
        cursor.execute("SHOW TABLES")
        tables = [row[0] for row in cursor.fetchall()]
        conn.close()
        return jsonify({'success': True, 'tables': tables})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/tables', methods=['POST'])
def list_tables():
    """List all tables in the connected database."""
    try:
        data = request.json
        conn = pymysql.connect(
            host=data.get('host', 'localhost'),
            port=int(data.get('port', 3306)),
            user=data.get('user', 'root'),
            password=data.get('password', ''),
            database=data.get('database', '')
        )
        cursor = conn.cursor()
        cursor.execute("SHOW TABLES")
        tables = [row[0] for row in cursor.fetchall()]
        conn.close()
        return jsonify({'success': True, 'tables': tables})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/extract', methods=['POST'])
def extract_data():
    """Extract all data from a specific table."""
    try:
        data = request.json
        host = data.get('host', 'localhost')
        port = int(data.get('port', 3306))
        user = data.get('user', 'root')
        password = data.get('password', '')
        database = data.get('database', '')
        table = data.get('table', '')

        if not database or not table:
            return jsonify({'success': False, 'error': 'Database name and table name are required'})

        # Validate table exists first via pymysql
        try:
            conn = pymysql.connect(host=host, port=port, user=user, password=password, database=database, connect_timeout=10)
        except pymysql.err.OperationalError as e:
            error_msg = str(e)
            if 'Access denied' in error_msg:
                return jsonify({'success': False, 'error': f'Access denied for user "{user}". Check username/password.'})
            elif 'Unknown database' in error_msg:
                return jsonify({'success': False, 'error': f'Database "{database}" does not exist.'})
            elif 'Can\'t connect' in error_msg or 'Connection refused' in error_msg:
                return jsonify({'success': False, 'error': f'Cannot connect to MySQL at {host}:{port}. Is MySQL running?'})
            else:
                return jsonify({'success': False, 'error': f'Connection error: {error_msg}'})

        cursor = conn.cursor()
        cursor.execute("SHOW TABLES")
        valid_tables = [row[0] for row in cursor.fetchall()]
        conn.close()

        if table not in valid_tables:
            return jsonify({'success': False, 'error': f'Table "{table}" not found in database "{database}"'})

        # Use SQLAlchemy engine for pandas
        encoded_pw = quote_plus(password)
        engine = create_engine(f"mysql+pymysql://{user}:{encoded_pw}@{host}:{port}/{database}")
        
        # Limit to 10000 rows for large tables
        df = pd.read_sql(f"SELECT * FROM `{table}` LIMIT 10000", engine)
        engine.dispose()

        if len(df) == 0:
            return jsonify({'success': False, 'error': f'Table "{table}" is empty (0 rows)'})

        columns = df.columns.tolist()
        
        # Convert to JSON-safe records preserving column order
        records = []
        for _, row in df.iterrows():
            record = {}
            for col in columns:
                val = row[col]
                if pd.isnull(val):
                    record[col] = None
                elif isinstance(val, (np.integer,)):
                    record[col] = int(val)
                elif isinstance(val, (np.floating,)):
                    record[col] = float(val)
                elif isinstance(val, (np.bool_,)):
                    record[col] = bool(val)
                elif isinstance(val, (pd.Timestamp,)):
                    record[col] = val.isoformat()
                elif isinstance(val, bytes):
                    record[col] = val.decode('utf-8', errors='replace')
                elif hasattr(val, 'isoformat'):
                    # Handle datetime.date, datetime.datetime
                    record[col] = val.isoformat()
                else:
                    # Handle Decimal and other types
                    try:
                        record[col] = float(val) if isinstance(val, decimal.Decimal) else val
                    except (TypeError, ValueError):
                        record[col] = str(val)
            records.append(record)

        return jsonify({'success': True, 'data': records, 'columns': columns, 'rowCount': len(records)})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': f'Extraction failed: {str(e)}'})


# ============================================================
# EDA & Data Cleaning
# ============================================================

# Common abbreviation/synonym mappings for standardization
COMMON_STANDARDIZATIONS = {
    'gender': {
        'm': 'Male', 'male': 'Male', 'man': 'Male', 'boy': 'Male',
        'f': 'Female', 'female': 'Female', 'woman': 'Female', 'girl': 'Female',
        '0': 'Female', '1': 'Male',  # common binary encoding
    },
    'status': {
        'y': 'Yes', 'yes': 'Yes', 'true': 'Yes', 'active': 'Active',
        'n': 'No', 'no': 'No', 'false': 'No', 'inactive': 'Inactive',
    },
}

def detect_column_mapping(col_name, unique_vals):
    """Auto-detect if a column matches a known abbreviation pattern."""
    col_lower = col_name.lower().strip()
    
    # Check if column name matches known categories
    for category, mappings in COMMON_STANDARDIZATIONS.items():
        if category in col_lower:
            return mappings
    
    # Check if values suggest a gender column
    vals_lower = {str(v).strip().lower() for v in unique_vals if pd.notna(v)}
    gender_indicators = {'m', 'f', 'male', 'female', 'man', 'woman', 'boy', 'girl'}
    if len(vals_lower & gender_indicators) >= 2:
        return COMMON_STANDARDIZATIONS['gender']
    
    return None


def detect_outliers_iqr(series, multiplier=1.5):
    """Detect outliers using IQR method. Returns boolean mask of outlier positions."""
    Q1 = series.quantile(0.25)
    Q3 = series.quantile(0.75)
    IQR = Q3 - Q1
    if IQR == 0:
        # If IQR is 0, use a different method (3 standard deviations)
        mean = series.mean()
        std = series.std()
        if std == 0:
            return pd.Series(False, index=series.index)
        return (series < mean - 3 * std) | (series > mean + 3 * std)
    lower = Q1 - multiplier * IQR
    upper = Q3 + multiplier * IQR
    return (series < lower) | (series > upper)


@app.route('/api/eda', methods=['POST'])
def run_eda():
    """Perform comprehensive EDA and data cleaning."""
    try:
        data = request.json
        records = data.get('data', [])
        columns = data.get('columns', [])

        if not records:
            return jsonify({'success': False, 'error': 'No data provided'})

        # Create DataFrame preserving column order from the original table
        df = pd.DataFrame(records)
        if columns:
            existing_cols = [c for c in columns if c in df.columns]
            extra_cols = [c for c in df.columns if c not in columns]
            df = df[existing_cols + extra_cols]

        original_columns = df.columns.tolist()
        original_count = len(df)
        cleaning_steps = []
        downsides = []
        improvements = []
        trash_indices = set()
        anomalies_found = []

        # ---- Step 1: Check for completely empty rows ----
        empty_mask = df.isnull().all(axis=1)
        str_empty_mask = df.apply(
            lambda row: all(
                (pd.isnull(v)) or (isinstance(v, str) and v.strip() == '')
                for v in row
            ), axis=1
        )
        combined_empty = empty_mask | str_empty_mask
        empty_count = combined_empty.sum()
        if empty_count > 0:
            trash_indices.update(df[combined_empty].index.tolist())
            cleaning_steps.append(f"Removed {empty_count} completely empty rows")
            downsides.append(f"Dataset contained {empty_count} empty rows")
            anomalies_found.append(f"{empty_count} empty rows")

        # ---- Step 2: Handle duplicate rows ----
        dup_mask = df.duplicated(keep='first')
        dup_count = dup_mask.sum()
        if dup_count > 0:
            trash_indices.update(df[dup_mask].index.tolist())
            cleaning_steps.append(f"Removed {dup_count} duplicate rows")
            downsides.append(f"Found {dup_count} duplicate entries that skew analysis")
            anomalies_found.append(f"{dup_count} duplicate rows")

        # ---- Step 3: Handle missing values ----
        null_counts = df.isnull().sum()
        cols_with_nulls = null_counts[null_counts > 0]
        if len(cols_with_nulls) > 0:
            for col in cols_with_nulls.index:
                n = int(cols_with_nulls[col])
                if pd.api.types.is_numeric_dtype(df[col]):
                    median_val = df[col].median()
                    df[col] = df[col].fillna(median_val)
                    cleaning_steps.append(f"Filled {n} missing values in '{col}' with median ({median_val:.2f})")
                else:
                    mode_val = df[col].mode()
                    fill_val = mode_val.iloc[0] if len(mode_val) > 0 else 'Unknown'
                    df[col] = df[col].fillna(fill_val)
                    cleaning_steps.append(f"Filled {n} missing values in '{col}' with '{fill_val}'")
            downsides.append(f"{len(cols_with_nulls)} columns had missing values: {', '.join(cols_with_nulls.index.tolist())}")
            improvements.append("All missing values handled using statistical imputation (median for numbers, mode for text)")
            anomalies_found.append(f"Missing values in {len(cols_with_nulls)} columns")

        # ---- Step 4: Trim whitespace in string columns ----
        str_cols = df.select_dtypes(include='object').columns
        trimmed_count = 0
        for col in str_cols:
            mask = df[col].notna()
            if mask.any():
                original_vals = df.loc[mask, col].copy()
                stripped_vals = df.loc[mask, col].astype(str).str.strip()
                changed = (original_vals.astype(str) != stripped_vals).sum()
                trimmed_count += changed
                df.loc[mask, col] = stripped_vals
        if trimmed_count > 0:
            cleaning_steps.append(f"Trimmed whitespace in {len(str_cols)} text columns ({trimmed_count} cells affected)")

        # ---- Step 5: CASE NORMALIZATION for text columns ----
        # This fixes: "JEANS" vs "Jeans" vs "jeans" → "Jeans"
        #             "Male" vs "male" vs "MALE" → "Male"
        case_fixes_total = 0
        case_details = []
        for col in str_cols:
            mask = df[col].notna()
            if not mask.any():
                continue
            
            vals = df.loc[mask, col].astype(str)
            unique_vals = vals.unique()
            
            # Group values by their lowercase form
            case_groups = {}
            for v in unique_vals:
                key = v.strip().lower()
                if key not in case_groups:
                    case_groups[key] = []
                case_groups[key].append(v)
            
            # Find groups with inconsistent casing
            inconsistent = {k: v for k, v in case_groups.items() if len(v) > 1}
            
            if inconsistent:
                for lower_key, variants in inconsistent.items():
                    # Pick the most common variant as the standard, or use Title Case
                    variant_counts = {v: (vals == v).sum() for v in variants}
                    most_common = max(variant_counts, key=variant_counts.get)
                    # Prefer title case if the most common isn't already proper
                    standard = most_common if most_common[0].isupper() else lower_key.title()
                    
                    for variant in variants:
                        if variant != standard:
                            count = int((df[col] == variant).sum())
                            df.loc[df[col] == variant, col] = standard
                            case_fixes_total += count
                            case_details.append(f"'{variant}' → '{standard}' in {col}")
        
        if case_fixes_total > 0:
            cleaning_steps.append(f"Standardized casing in text columns ({case_fixes_total} values fixed): {'; '.join(case_details[:5])}")
            downsides.append(f"Inconsistent casing found (e.g., {', '.join(case_details[:3])})")
            improvements.append("All text values standardized to consistent casing")
            anomalies_found.append(f"Inconsistent casing: {case_fixes_total} values across multiple columns")

        # ---- Step 6: Abbreviation / Synonym Standardization ----
        # Detect columns like "gender" and map M→Male, F→Female, etc.
        abbrev_fixes_total = 0
        abbrev_details = []
        for col in str_cols:
            mask = df[col].notna()
            if not mask.any():
                continue
            
            unique_vals = df.loc[mask, col].unique()
            mapping = detect_column_mapping(col, unique_vals)
            
            if mapping:
                for idx in df.index:
                    val = df.at[idx, col]
                    if pd.notna(val):
                        val_lower = str(val).strip().lower()
                        if val_lower in mapping and str(val) != mapping[val_lower]:
                            abbrev_fixes_total += 1
                            df.at[idx, col] = mapping[val_lower]
                
                if abbrev_fixes_total > 0:
                    # Report what was standardized
                    new_unique = df.loc[mask, col].unique()
                    abbrev_details.append(f"'{col}': standardized to {list(set(new_unique))}")
        
        if abbrev_fixes_total > 0:
            cleaning_steps.append(f"Standardized abbreviations/synonyms ({abbrev_fixes_total} values): {'; '.join(abbrev_details[:3])}")
            downsides.append(f"Found abbreviated/inconsistent category labels (e.g., M/F instead of Male/Female)")
            improvements.append("Abbreviations and synonyms mapped to their full standard form")
            anomalies_found.append(f"Abbreviation inconsistency: {abbrev_fixes_total} values standardized")

        # ---- Step 7: Fix data types (conservative) ----
        type_fixes = 0
        for col in df.columns:
            if df[col].dtype == 'object':
                non_null = df[col].dropna()
                if len(non_null) == 0:
                    continue
                converted = pd.to_numeric(non_null, errors='coerce')
                if converted.notna().all() and len(non_null) > 0:
                    df[col] = pd.to_numeric(df[col], errors='coerce')
                    type_fixes += 1
        if type_fixes > 0:
            cleaning_steps.append(f"Converted {type_fixes} columns from text to numeric type")
            improvements.append(f"Fixed data types for {type_fixes} columns stored as text but containing numbers")

        # ---- Step 8: OUTLIER DETECTION using IQR with ROW DEDUPLICATION ----
        # Use a unified bitwise OR mask — each row flagged AT MOST ONCE
        # regardless of how many columns are anomalous.
        # NaN imputation already happened in Step 3, so nulls won't be falsely flagged.
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        
        # Filter to valid rows not already in trash
        valid_mask = ~df.index.isin(trash_indices)
        
        # Build unified outlier mask across ALL numeric columns
        unified_outlier_mask = pd.Series(False, index=df.index)
        outlier_details = []
        per_col_counts = {}
        
        for col in numeric_cols:
            # Skip ID-like columns (>90% unique) or binary columns
            unique_ratio = df[col].nunique() / max(len(df), 1)
            if unique_ratio > 0.9 or df[col].nunique() <= 2:
                continue
            
            valid_series = df.loc[valid_mask, col].dropna()
            if len(valid_series) < 10:
                continue
            
            col_outlier_mask = detect_outliers_iqr(valid_series)
            col_outlier_indices = valid_series[col_outlier_mask].index
            
            if len(col_outlier_indices) > 0:
                outlier_vals = valid_series[col_outlier_mask]
                min_out = outlier_vals.min()
                max_out = outlier_vals.max()
                Q1 = valid_series.quantile(0.25)
                Q3 = valid_series.quantile(0.75)
                median_val = valid_series.median()
                
                per_col_counts[col] = len(col_outlier_indices)
                outlier_details.append(
                    f"'{col}': {len(col_outlier_indices)} outliers "
                    f"(values {min_out:.0f}–{max_out:.0f}, normal range {Q1:.0f}–{Q3:.0f}, median={median_val:.0f})"
                )
                
                # Bitwise OR — merge into unified mask (row counted once even if anomalous in multiple cols)
                unified_outlier_mask.loc[col_outlier_indices] = True
        
        # Apply the unified mask
        outlier_row_indices = df.index[unified_outlier_mask & valid_mask].tolist()
        outlier_total_rows = len(outlier_row_indices)
        outlier_total_flags = sum(per_col_counts.values())  # total per-column flags (for reporting)
        
        if outlier_total_rows > 0:
            trash_indices.update(outlier_row_indices)
            cleaning_steps.append(
                f"Detected {outlier_total_rows} anomalous rows "
                f"({outlier_total_flags} outlier flags across {len(per_col_counts)} columns, deduplicated to {outlier_total_rows} unique rows): "
                f"{'; '.join(outlier_details[:5])}"
            )
            downsides.append(
                f"Found {outlier_total_rows} rows with extreme outlier values that distort analysis: "
                f"{'; '.join(outlier_details[:3])}"
            )
            improvements.append(
                f"Outliers removed using IQR method (1.5× interquartile range) with row-level deduplication — "
                f"{outlier_total_flags} column-level flags consolidated into {outlier_total_rows} unique rows removed"
            )
            anomalies_found.append(f"{outlier_total_rows} rows with statistical outliers (across {len(per_col_counts)} numeric columns)")

        # Build trash and clean dataframes (preserve column order)
        trash_df = df.loc[list(trash_indices)][original_columns] if trash_indices else pd.DataFrame(columns=original_columns)
        clean_df = df.drop(index=list(trash_indices))[original_columns] if trash_indices else df[original_columns].copy()
        clean_df = clean_df.reset_index(drop=True)

        if not cleaning_steps:
            cleaning_steps.append("Data was already clean — no issues found!")
            improvements.append("The dataset appears to be well-formatted and ready for analysis")

        # Generate EDA statistics on CLEAN data
        eda_stats = {}
        for col in original_columns:
            col_stats = {'name': col}
            if pd.api.types.is_numeric_dtype(clean_df[col]):
                col_stats['type'] = 'numeric'
                if len(clean_df) > 0:
                    col_stats['min'] = float(clean_df[col].min())
                    col_stats['max'] = float(clean_df[col].max())
                    col_stats['mean'] = round(float(clean_df[col].mean()), 2)
                    col_stats['median'] = float(clean_df[col].median())
                    col_stats['std'] = round(float(clean_df[col].std()), 2)
                else:
                    col_stats.update({'min': 0, 'max': 0, 'mean': 0, 'median': 0, 'std': 0})
            else:
                col_stats['type'] = 'categorical'
                if len(clean_df) > 0:
                    col_stats['unique'] = int(clean_df[col].nunique())
                    mode = clean_df[col].mode()
                    col_stats['top'] = str(mode.iloc[0]) if len(mode) > 0 else 'N/A'
                    col_stats['topCount'] = int((clean_df[col] == col_stats['top']).sum())
                    col_stats['categories'] = clean_df[col].unique().tolist()[:20]
                else:
                    col_stats.update({'unique': 0, 'top': 'N/A', 'topCount': 0, 'categories': []})
            eda_stats[col] = col_stats

        downsides_str = "\n".join(f"• {d}" for d in downsides) if downsides else "No major issues found in the original data."
        improvements_str = "\n".join(f"• {imp}" for imp in improvements) if improvements else "Data quality was already good."
        anomalies_str = "\n".join(f"⚠️ {a}" for a in anomalies_found) if anomalies_found else "No anomalies detected."

        # Convert to JSON-safe format preserving column order
        def df_to_records(dataframe, col_order):
            result = []
            for _, row in dataframe.iterrows():
                record = {}
                for col in col_order:
                    val = row[col]
                    if pd.isnull(val):
                        record[col] = None
                    elif isinstance(val, (np.integer,)):
                        record[col] = int(val)
                    elif isinstance(val, (np.floating,)):
                        record[col] = float(val)
                    elif isinstance(val, (np.bool_,)):
                        record[col] = bool(val)
                    elif isinstance(val, (pd.Timestamp,)):
                        record[col] = val.isoformat()
                    elif isinstance(val, bytes):
                        record[col] = val.decode('utf-8', errors='replace')
                    else:
                        record[col] = val
                result.append(record)
            return result

        return jsonify({
            'success': True,
            'cleanData': df_to_records(clean_df, original_columns),
            'trashData': df_to_records(trash_df, original_columns),
            'columns': original_columns,
            'edaStats': eda_stats,
            'summary': {
                'steps': cleaning_steps,
                'downsides': downsides_str,
                'improvements': improvements_str,
                'anomalies': anomalies_str,
                'originalRows': original_count,
                'cleanRows': len(clean_df),
                'trashRows': len(trash_df),
            }
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)})



# ============================================================
# Gemini AI Endpoints
# ============================================================
@app.route('/api/gemini/validate', methods=['POST'])
def gemini_validate():
    """Use Gemini to validate the cleaned data with full context."""
    try:
        data = request.json
        summary = data.get('summary', {})
        original_rows = data.get('originalRows', 0)
        clean_rows = data.get('cleanRows', 0)
        trash_rows = data.get('trashRows', 0)
        columns = data.get('columns', [])
        eda_stats = data.get('edaStats', {})

        # Build stats summary for context
        stats_summary = []
        for col, stats in eda_stats.items():
            if stats.get('type') == 'numeric':
                stats_summary.append(f"  {col}: min={stats.get('min')}, max={stats.get('max')}, mean={stats.get('mean')}, std={stats.get('std')}")
            else:
                stats_summary.append(f"  {col}: {stats.get('unique')} unique values, top='{stats.get('top')}' ({stats.get('topCount')} occurrences)")

        prompt = f"""You are a Senior Data Quality Engineer. Validate this data cleaning report with precision.

DATASET INFO:
- Columns: {', '.join(columns)}
- Original rows: {original_rows}
- Clean rows after processing: {clean_rows}
- Rows removed to trash: {trash_rows} ({100*trash_rows/max(original_rows,1):.1f}% of data)

CLEANING STEPS PERFORMED:
{json.dumps(summary.get('steps', []), indent=2)}

ANOMALIES FOUND:
{summary.get('anomalies', 'None reported')}

CLEAN DATA STATISTICS:
{chr(10).join(stats_summary[:10])}

VALIDATION REQUIREMENTS:
1. Is the data removal percentage ({100*trash_rows/max(original_rows,1):.1f}%) reasonable? (>30% is concerning)
2. Were the right cleaning methods used? (IQR for outliers, case normalization, imputation)
3. Data quality score out of 10 (based on: completeness, consistency, accuracy)
4. One specific recommendation for downstream analysis

Keep response under 120 words. Be specific, not generic."""

        result = ask_gemini(prompt)
        if result:
            return jsonify({'success': True, 'validation': result})
        else:
            # Fallback
            removal_pct = 100 * trash_rows / max(original_rows, 1)
            quality = min(10, max(4, int(10 * clean_rows / max(original_rows, 1))))
            warning = " ⚠️ High removal rate — review trash data for false positives." if removal_pct > 20 else ""
            return jsonify({
                'success': True,
                'validation': f"✅ Data cleaning completed. Removed {trash_rows} rows ({removal_pct:.1f}% of data).{warning}\n\n📊 Data Quality Score: {quality}/10\n\n💡 Recommendation: The cleaned dataset with {clean_rows} rows across {len(columns)} columns is ready for visualization. Verify the trash data tab to confirm removed rows are genuine anomalies."
            })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/gemini/suggest-charts', methods=['POST'])
def gemini_suggest_charts():
    """Suggest suitable chart types based on selected columns."""
    try:
        data = request.json
        selected_cols = data.get('columns', [])
        all_cols = data.get('allColumns', [])
        sample = data.get('sampleData', [])

        col_count = len(selected_cols)

        prompt = f"""You are a data visualization expert. Given these selected columns from a dataset:

Selected columns: {', '.join(selected_cols)}
All available columns: {', '.join(all_cols)}
Sample data (first 5 rows): {json.dumps(sample[:3])}
Number of selected columns: {col_count}

Suggest the best chart types for visualizing this data. Return ONLY a JSON array of objects with "value" and "label" keys. 
- If 1 column is selected, suggest: bar, pie, area, line charts
- If multiple columns are selected, suggest: bar (grouped), line (multi), area (stacked), scatter, radar

Return ONLY the JSON array, nothing else. Example:
[{{"value": "bar", "label": "Bar Chart"}}, {{"value": "pie", "label": "Pie Chart"}}]"""

        result = ask_gemini(prompt)
        if result:
            # Try to parse JSON from the response
            try:
                # Extract JSON from possible markdown formatting
                json_str = result.strip()
                if '```' in json_str:
                    json_str = json_str.split('```')[1]
                    if json_str.startswith('json'):
                        json_str = json_str[4:]
                    json_str = json_str.strip()
                charts = json.loads(json_str)
                return jsonify({'success': True, 'charts': charts})
            except:
                pass

        # Fallback
        if col_count == 1:
            charts = [
                {"value": "bar", "label": "Bar Chart"},
                {"value": "pie", "label": "Pie Chart"},
                {"value": "area", "label": "Area Chart"},
                {"value": "line", "label": "Line Chart"},
            ]
        else:
            charts = [
                {"value": "bar", "label": "Grouped Bar"},
                {"value": "line", "label": "Multi-Line"},
                {"value": "area", "label": "Stacked Area"},
                {"value": "scatter", "label": "Scatter Plot"},
                {"value": "radar", "label": "Radar Chart"},
            ]
        return jsonify({'success': True, 'charts': charts})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/gemini/insight', methods=['POST'])
def gemini_insight():
    """Generate AI insight with structured stats for accuracy verification."""
    try:
        data = request.json
        chart_type = data.get('chartType', 'bar')
        chart_columns = data.get('columns', [])
        chart_data = data.get('data', [])

        if not chart_data:
            return jsonify({'success': True, 'insight': '📊 No data available for insight generation.'})

        # ---- Build structured statistics block for accuracy ----
        stats_block = {
            'chart_type': chart_type,
            'columns': chart_columns,
            'n_data_points': len(chart_data),
        }

        # Extract all numeric values per key
        numeric_keys = {}
        for item in chart_data:
            for key, val in item.items():
                if key == 'name':
                    continue
                if isinstance(val, (int, float)):
                    if key not in numeric_keys:
                        numeric_keys[key] = []
                    numeric_keys[key].append(val)

        # Per-key statistics
        key_stats = {}
        total_value = 0
        for key, values in numeric_keys.items():
            s = pd.Series(values)
            key_stats[key] = {
                'count': len(values),
                'sum': round(float(s.sum()), 2),
                'mean': round(float(s.mean()), 2),
                'median': round(float(s.median()), 2),
                'min': round(float(s.min()), 2),
                'max': round(float(s.max()), 2),
                'std': round(float(s.std()), 2) if len(values) > 1 else 0,
            }
            total_value += float(s.sum())

        stats_block['value_statistics'] = key_stats
        stats_block['total_value'] = round(total_value, 2)

        # Find top and bottom entries
        main_key = list(numeric_keys.keys())[0] if numeric_keys else 'value'
        sorted_data = sorted(chart_data, key=lambda x: x.get(main_key, x.get('value', 0)) if isinstance(x.get(main_key, x.get('value', 0)), (int, float)) else 0, reverse=True)
        
        stats_block['top_3'] = sorted_data[:3]
        stats_block['bottom_3'] = sorted_data[-3:]
        stats_block['average_per_category'] = round(total_value / max(len(chart_data), 1), 2)

        # Correlation if 2+ numeric columns
        if len(numeric_keys) >= 2:
            keys_list = list(numeric_keys.keys())
            try:
                corr_df = pd.DataFrame({k: numeric_keys[k] for k in keys_list[:3]})
                stats_block['correlations'] = corr_df.corr().round(4).to_dict()
            except:
                pass

        # ---- Expert system prompt ----
        prompt = f"""You are a Senior Data Scientist conducting a professional EDA review.
Analyze this chart data and provide an accurate, verified insight.

STATISTICS BLOCK (use these numbers — do NOT guess):
{json.dumps(stats_block, indent=2)}

FULL DATA ({len(chart_data)} entries):
{json.dumps(chart_data[:20])}

MANDATORY ACCURACY RULES:
1. Cross-reference EVERY number you mention against the Statistics Block above
2. Name the TOP category/value and its EXACT number from the data
3. Compare it to the average ({stats_block['average_per_category']:,.0f}) — is it above/below and by how much?
4. Mention the distribution pattern: is it skewed, uniform, or concentrated?
5. If you see any notable gaps or clusters in the data, mention them
6. DO NOT invent trends, correlations, or patterns not supported by the data
7. Keep response to 2-3 sentences maximum
8. Start with an appropriate emoji

Respond with the insight only, no preamble."""

        result = ask_gemini(prompt)
        if result:
            return jsonify({'success': True, 'insight': result.strip()})
        else:
            # Fallback with accurate computed stats
            if sorted_data:
                top = sorted_data[0]
                top_name = top.get('name', 'N/A')
                top_val = top.get(main_key, top.get('value', 0))
                avg_val = stats_block['average_per_category']
                pct_of_total = (top_val / max(total_value, 1)) * 100
                
                # Distribution analysis
                if len(sorted_data) >= 3:
                    top3_sum = sum(item.get(main_key, item.get('value', 0)) for item in sorted_data[:3] if isinstance(item.get(main_key, item.get('value', 0)), (int, float)))
                    top3_pct = (top3_sum / max(total_value, 1)) * 100
                    dist_note = f"Top 3 categories account for {top3_pct:.0f}% of total."
                else:
                    dist_note = ""
                
                return jsonify({
                    'success': True,
                    'insight': f'📊 "{top_name}" leads with {top_val:,.0f} ({pct_of_total:.1f}% of total {total_value:,.0f}), which is {top_val/max(avg_val,1):.1f}× the average of {avg_val:,.0f}. {dist_note}'
                })
            return jsonify({'success': True, 'insight': '📊 Insufficient data for insight generation.'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


# ============================================================
# Save Summary to C Drive
# ============================================================
@app.route('/api/save-summary', methods=['POST'])
def save_summary():
    """Save EDA summary as a .docx file to C:\\ErrorLog\\{database_name}\\."""
    try:
        data = request.json
        database = data.get('database', 'unknown_db')
        table = data.get('table', 'unknown_table')
        summary = data.get('summary', {})
        eda_stats = data.get('edaStats', {})

        # Create directory
        folder_path = os.path.join('C:\\', 'ErrorLog', database)
        os.makedirs(folder_path, exist_ok=True)

        # Create .docx document
        doc = Document()
        
        # Title
        title = doc.add_heading(f'EDA Summary Report', level=0)
        title.alignment = WD_ALIGN_PARAGRAPH.CENTER
        
        doc.add_paragraph(f'Database: {database}')
        doc.add_paragraph(f'Table: {table}')
        doc.add_paragraph(f'Generated: {pd.Timestamp.now().strftime("%Y-%m-%d %H:%M:%S")}')
        doc.add_paragraph('')  # spacer

        # Row Statistics
        doc.add_heading('Row Statistics', level=1)
        doc.add_paragraph(f'Original Rows: {summary.get("originalRows", "N/A")}')
        doc.add_paragraph(f'Clean Rows: {summary.get("cleanRows", "N/A")}')
        doc.add_paragraph(f'Removed Rows: {summary.get("trashRows", "N/A")}')

        # Cleaning Steps
        doc.add_heading('Cleaning Steps Performed', level=1)
        steps = summary.get('steps', [])
        if steps:
            for step in steps:
                doc.add_paragraph(step, style='List Bullet')
        else:
            doc.add_paragraph('No cleaning steps were needed.')

        # Anomalies
        doc.add_heading('Anomalies Detected', level=1)
        anomalies = summary.get('anomalies', 'No anomalies detected.')
        doc.add_paragraph(anomalies)

        # Data Quality Issues
        doc.add_heading('Data Quality Issues (Downsides)', level=1)
        downsides = summary.get('downsides', 'No major issues found.')
        doc.add_paragraph(downsides)

        # Improvements Made
        doc.add_heading('Improvements Made', level=1)
        improvements = summary.get('improvements', 'Data quality was already good.')
        doc.add_paragraph(improvements)

        # Per-Column Statistics
        doc.add_heading('Column Statistics (Clean Data)', level=1)
        if eda_stats:
            for col_name, stats in eda_stats.items():
                doc.add_heading(f'{col_name}', level=2)
                if stats.get('type') == 'numeric':
                    doc.add_paragraph(f'Type: Numeric')
                    doc.add_paragraph(f'Min: {stats.get("min", "N/A")}')
                    doc.add_paragraph(f'Max: {stats.get("max", "N/A")}')
                    doc.add_paragraph(f'Mean: {stats.get("mean", "N/A")}')
                    doc.add_paragraph(f'Median: {stats.get("median", "N/A")}')
                    doc.add_paragraph(f'Std Dev: {stats.get("std", "N/A")}')
                else:
                    doc.add_paragraph(f'Type: Categorical')
                    doc.add_paragraph(f'Unique Values: {stats.get("unique", "N/A")}')
                    doc.add_paragraph(f'Most Common: {stats.get("top", "N/A")} ({stats.get("topCount", 0)} occurrences)')
                    categories = stats.get('categories', [])
                    if categories:
                        doc.add_paragraph(f'Categories: {", ".join(str(c) for c in categories[:15])}')
        else:
            doc.add_paragraph('No column statistics available.')

        # Save file
        file_path = os.path.join(folder_path, f'{table}_summary.docx')
        doc.save(file_path)

        return jsonify({
            'success': True,
            'message': f'Summary saved to {file_path}',
            'filePath': file_path
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)})


# ============================================================
# Excel / CSV File Upload  (mirrors /api/extract JSON shape)
# ============================================================
ALLOWED_EXTENSIONS = {'.xlsx', '.xls', '.csv'}

def _serialize_df_to_records(df):
    """Convert a DataFrame to JSON-safe records (same as /api/extract)."""
    records = []
    for _, row in df.iterrows():
        record = {}
        for col in df.columns:
            val = row[col]
            if pd.isnull(val) if not isinstance(val, (list, dict)) else False:
                record[col] = None
            elif isinstance(val, (np.integer,)):
                record[col] = int(val)
            elif isinstance(val, (np.floating,)):
                record[col] = float(val)
            elif isinstance(val, (np.bool_,)):
                record[col] = bool(val)
            elif isinstance(val, pd.Timestamp):
                record[col] = val.isoformat()
            elif isinstance(val, bytes):
                record[col] = val.decode('utf-8', errors='replace')
            elif hasattr(val, 'isoformat'):
                record[col] = val.isoformat()
            else:
                try:
                    record[col] = float(val) if isinstance(val, decimal.Decimal) else val
                except (TypeError, ValueError):
                    record[col] = str(val)
        records.append(record)
    return records


@app.route('/api/upload-excel', methods=['POST'])
def upload_excel():
    """Accept an Excel (.xlsx/.xls) or CSV file upload and return data
    in the same JSON shape as /api/extract so the frontend EDA pipeline
    is completely source-agnostic."""
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No file provided. Include a file in the "file" field.'})

        f = request.files['file']
        filename = secure_filename(f.filename)
        ext = os.path.splitext(filename)[1].lower()

        if ext not in ALLOWED_EXTENSIONS:
            return jsonify({'success': False, 'error': f'Unsupported file type "{ext}". Allowed: .xlsx, .xls, .csv'})

        file_bytes = f.read()
        if len(file_bytes) == 0:
            return jsonify({'success': False, 'error': 'The uploaded file is empty.'})

        # Parse the file
        try:
            if ext == '.csv':
                # Try UTF-8 first, fall back to latin-1
                try:
                    df = pd.read_csv(io.BytesIO(file_bytes), encoding='utf-8')
                except UnicodeDecodeError:
                    df = pd.read_csv(io.BytesIO(file_bytes), encoding='latin-1')
            else:
                df = pd.read_excel(io.BytesIO(file_bytes), engine='openpyxl' if ext == '.xlsx' else 'xlrd')
        except Exception as parse_err:
            return jsonify({'success': False, 'error': f'Could not parse file: {str(parse_err)}'})

        # Basic guards
        if df.empty or len(df.columns) == 0:
            return jsonify({'success': False, 'error': 'The file appears to be empty or has no columns.'})

        # Trim whitespace from column names
        df.columns = [str(c).strip() for c in df.columns]

        # Limit to 10,000 rows (same limit as MySQL extract)
        if len(df) > 10000:
            df = df.head(10000)

        columns = df.columns.tolist()
        records = _serialize_df_to_records(df)

        # Derive a clean display name from filename
        base_name = os.path.splitext(filename)[0]

        return jsonify({
            'success': True,
            'data': records,
            'columns': columns,
            'rowCount': len(records),
            'fileName': base_name,
            'source': 'excel',
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': f'Upload processing failed: {str(e)}'})


# ============================================================
# Health Check
# ============================================================
@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'gemini': 'connected' if model else 'fallback mode',
    })


if __name__ == '__main__':
    print("\nDataViz Pro Backend Server")
    print("=" * 40)
    print(f"Server: http://localhost:5000")
    print(f"Gemini AI: {'[OK] Connected' if model else '[WARN] Fallback mode (set GEMINI_API_KEY in .env)'}")
    print("=" * 40 + "\n")
    app.run(host='0.0.0.0', port=5000, debug=True)
