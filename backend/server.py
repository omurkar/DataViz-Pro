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
# Phase 1-3: Zero-Click Auto-Visualization Engine
# ============================================================

TEMPORAL_KEYWORDS = [
    'date', 'time', 'year', 'month', 'day', 'week', 'quarter',
    'timestamp', 'period', 'created', 'updated', 'at', 'on',
]
ID_KEYWORDS = ['id', 'key', 'uuid', 'guid', 'code', 'ref', 'no', 'num', 'number']


def _classify_column(col_name, series, n_rows):
    """
    Classify a column into: 'temporal', 'categorical', 'continuous', 'unique_id', 'boolean'
    Returns dict with type, stats, sample_values.
    """
    col_lower = col_name.lower().strip()
    unique_count = series.nunique()
    unique_ratio = unique_count / max(n_rows, 1)

    # --- Try datetime parsing first ---
    if any(kw in col_lower for kw in TEMPORAL_KEYWORDS):
        try:
            parsed = pd.to_datetime(series, infer_datetime_format=True, errors='coerce')
            if parsed.notna().mean() > 0.7:
                return {
                    'type': 'temporal',
                    'unique': int(unique_count),
                    'sample': [str(v) for v in parsed.dropna().head(3).tolist()],
                }
        except Exception:
            pass

    # --- Check actual dtype ---
    if pd.api.types.is_datetime64_any_dtype(series):
        return {
            'type': 'temporal',
            'unique': int(unique_count),
            'sample': [str(v) for v in series.dropna().head(3).tolist()],
        }

    if pd.api.types.is_bool_dtype(series):
        return {'type': 'boolean', 'unique': 2, 'sample': series.dropna().unique().tolist()[:3]}

    if pd.api.types.is_numeric_dtype(series):
        # Binary → boolean-like
        if unique_count <= 2:
            return {'type': 'boolean', 'unique': int(unique_count), 'sample': series.unique().tolist()[:2]}
        # Unique IDs (very high cardinality integers)
        if unique_ratio > 0.9 and any(kw in col_lower for kw in ID_KEYWORDS):
            return {'type': 'unique_id', 'unique': int(unique_count), 'sample': []}
        # Continuous
        desc = series.describe()
        variance = float(series.var()) if len(series) > 1 else 0
        return {
            'type': 'continuous',
            'unique': int(unique_count),
            'min': float(desc['min']) if not pd.isnull(desc.get('min', float('nan'))) else 0,
            'max': float(desc['max']) if not pd.isnull(desc.get('max', float('nan'))) else 0,
            'mean': round(float(desc['mean']), 2) if not pd.isnull(desc.get('mean', float('nan'))) else 0,
            'median': round(float(series.median()), 2),
            'std': round(float(desc['std']), 2) if not pd.isnull(desc.get('std', float('nan'))) else 0,
            'variance': round(variance, 4),
            'sample': [],
        }

    # --- String columns ---
    if any(kw in col_lower for kw in ID_KEYWORDS) and unique_ratio > 0.9:
        return {'type': 'unique_id', 'unique': int(unique_count), 'sample': []}

    if unique_count <= 30:
        return {
            'type': 'categorical',
            'unique': int(unique_count),
            'categories': series.dropna().unique().tolist()[:20],
            'sample': series.dropna().head(3).tolist(),
        }

    # High-cardinality string → treat as unique_id or skip
    return {'type': 'unique_id', 'unique': int(unique_count), 'sample': []}


def _auto_clean(df):
    """
    Phase 1 auto cleaning:
    - Drop columns with >80% null values
    - Impute columns with <5% nulls (mean/median for numeric, mode for categorical)
    Returns cleaned df and a list of step descriptions.
    """
    steps = []
    n = len(df)

    # Drop high-null columns
    null_ratios = df.isnull().mean()
    drop_cols = null_ratios[null_ratios > 0.8].index.tolist()
    if drop_cols:
        df = df.drop(columns=drop_cols)
        steps.append(f"Dropped {len(drop_cols)} columns with >80% nulls: {', '.join(drop_cols)}")

    # Impute low-null columns
    for col in df.columns:
        ratio = df[col].isnull().mean()
        if 0 < ratio <= 0.05:
            if pd.api.types.is_numeric_dtype(df[col]):
                fill_val = df[col].median()
                df[col] = df[col].fillna(fill_val)
                steps.append(f"Imputed '{col}' ({ratio*100:.1f}% nulls) with median {fill_val:.2f}")
            else:
                fill_val = df[col].mode().iloc[0] if len(df[col].mode()) > 0 else 'Unknown'
                df[col] = df[col].fillna(fill_val)
                steps.append(f"Imputed '{col}' ({ratio*100:.1f}% nulls) with mode '{fill_val}'")

    return df, steps


def _build_chart_data(df, x_col, y_col=None, agg='sum', limit=20):
    """Build compact chart data arrays from a DataFrame."""
    if y_col is None:
        # Distribution: single numeric column histogram
        series = df[x_col].dropna()
        bins = pd.cut(series, bins=min(10, series.nunique()), precision=1)
        counts = bins.value_counts().sort_index()
        return [{'name': str(k), 'value': int(v)} for k, v in counts.items()]

    # Group-by aggregation
    try:
        if agg == 'sum':
            grouped = df.groupby(x_col)[y_col].sum()
        elif agg == 'mean':
            grouped = df.groupby(x_col)[y_col].mean()
        elif agg == 'count':
            grouped = df.groupby(x_col)[y_col].count()
        else:
            grouped = df.groupby(x_col)[y_col].sum()
    except Exception:
        return []

    grouped = grouped.sort_values(ascending=False).head(limit)
    return [{'name': str(k), 'value': round(float(v), 2)} for k, v in grouped.items()]


def _build_scatter_data(df, x_col, y_col, limit=200):
    sub = df[[x_col, y_col]].dropna().head(limit)
    return [{'x': round(float(r[x_col]), 4), 'y': round(float(r[y_col]), 4)} for _, r in sub.iterrows()]


def _build_timeseries_data(df, date_col, value_col, limit=60):
    tmp = df[[date_col, value_col]].copy()
    tmp[date_col] = pd.to_datetime(tmp[date_col], errors='coerce')
    tmp = tmp.dropna(subset=[date_col])
    tmp = tmp.sort_values(date_col)
    tmp = tmp.groupby(date_col)[value_col].sum().reset_index()
    tmp = tmp.tail(limit)
    return [{'name': str(r[date_col])[:10], 'value': round(float(r[value_col]), 2)} for _, r in tmp.iterrows()]


def _heuristic_charts(df, schema, n_rows):
    """
    Phase 2 heuristic engine — returns list of chart config dicts.
    Rules:
      Time-Series: 1 temporal + 1 continuous → line
      Ranking:     1 categorical (<15 unique) + 1 continuous → bar
      Correlation: 2 continuous → scatter
      Distribution: 1 continuous → histogram
      Top KPIs:    SUM / AVG of highest-variance continuous cols
    """
    charts = []
    kpi_cards = []

    temporals = [c for c, m in schema.items() if m['type'] == 'temporal']
    categoricals = [c for c, m in schema.items() if m['type'] == 'categorical' and m.get('unique', 999) <= 15]
    continuous = sorted(
        [c for c, m in schema.items() if m['type'] == 'continuous'],
        key=lambda c: schema[c].get('variance', 0), reverse=True
    )

    chart_id = 0

    # --- KPI Cards: top-3 highest-variance numeric columns ---
    for col in continuous[:3]:
        total = df[col].sum()
        avg = df[col].mean()
        fmt_total = f"{total:,.0f}" if abs(total) < 1e9 else f"{total/1e6:,.1f}M"
        kpi_cards.append({
            'id': f'kpi_{col}',
            'title': col.replace('_', ' ').title(),
            'value': fmt_total,
            'trend': f"avg {avg:,.1f}",
            'column': col,
        })

    # --- Time-Series Rules ---
    for t_col in temporals[:2]:
        for v_col in continuous[:3]:
            chart_id += 1
            data = _build_timeseries_data(df, t_col, v_col)
            if len(data) < 2:
                continue
            charts.append({
                'id': f'chart_{chart_id}',
                'type': 'line',
                'title': f'{v_col.replace("_"," ").title()} Over Time',
                'xAxis': t_col,
                'yAxis': v_col,
                'data': data,
            })

    # --- Ranking (Bar) Rules ---
    for cat_col in categoricals[:3]:
        for v_col in continuous[:2]:
            chart_id += 1
            data = _build_chart_data(df, cat_col, v_col, agg='sum')
            if not data:
                continue
            charts.append({
                'id': f'chart_{chart_id}',
                'type': 'bar',
                'title': f'{v_col.replace("_"," ").title()} by {cat_col.replace("_"," ").title()}',
                'xAxis': cat_col,
                'yAxis': v_col,
                'data': data,
            })

    # --- Correlation (Scatter) ---
    if len(continuous) >= 2:
        chart_id += 1
        data = _build_scatter_data(df, continuous[0], continuous[1])
        if data:
            charts.append({
                'id': f'chart_{chart_id}',
                'type': 'scatter',
                'title': f'{continuous[0].replace("_"," ").title()} vs {continuous[1].replace("_"," ").title()}',
                'xAxis': continuous[0],
                'yAxis': continuous[1],
                'data': data,
            })

    # --- Distribution (Histogram) ---
    for v_col in continuous[:2]:
        chart_id += 1
        data = _build_chart_data(df, v_col)
        if data:
            charts.append({
                'id': f'chart_{chart_id}',
                'type': 'bar',
                'title': f'Distribution of {v_col.replace("_"," ").title()}',
                'xAxis': 'Range',
                'yAxis': 'Count',
                'isDistribution': True,
                'data': data,
            })

    # --- Pie chart for first categorical ---
    if categoricals:
        cat_col = categoricals[0]
        chart_id += 1
        if continuous:
            data = _build_chart_data(df, cat_col, continuous[0], agg='sum')
        else:
            counts = df[cat_col].value_counts().head(10)
            data = [{'name': str(k), 'value': int(v)} for k, v in counts.items()]
        if data:
            charts.append({
                'id': f'chart_{chart_id}',
                'type': 'pie',
                'title': f'{cat_col.replace("_"," ").title()} Breakdown',
                'xAxis': cat_col,
                'yAxis': continuous[0] if continuous else 'count',
                'data': data,
            })

    return kpi_cards, charts[:8]  # cap at 8 charts


def _llm_charts(df, schema, n_rows):
    """
    Phase 2 LLM path: ask Gemini to select the 5 best charts.
    Returns (kpi_cards, charts) tuples on success, or falls back to heuristic.
    """
    if not model:
        return _heuristic_charts(df, schema, n_rows)

    sample_rows = df.head(5).to_dict(orient='records')
    # Serialize for JSON
    for row in sample_rows:
        for k, v in row.items():
            if pd.isnull(v) if not isinstance(v, (list, dict)) else False:
                row[k] = None
            elif isinstance(v, (np.integer,)):
                row[k] = int(v)
            elif isinstance(v, (np.floating,)):
                row[k] = round(float(v), 4)
            elif isinstance(v, pd.Timestamp):
                row[k] = str(v)

    schema_for_prompt = {
        col: {'type': meta['type'], 'unique': meta.get('unique'), 'sample': meta.get('sample', [])}
        for col, meta in schema.items()
    }

    prompt = f"""You are a Senior Data Analyst. Given this dataset schema and sample rows, 
select the 5 most analytically insightful charts to build.

SCHEMA (column → semantic type):
{json.dumps(schema_for_prompt, indent=2)}

SAMPLE ROWS (first 5):
{json.dumps(sample_rows, indent=2)}

RULES:
- temporal + continuous → "line" chart
- categorical (<=15 unique) + continuous → "bar" chart
- 2 continuous → "scatter" chart
- 1 continuous alone → "bar" histogram
- categorical breakdown → "pie" chart

Return ONLY a valid JSON array of exactly 5 objects, no markdown, no prose:
[
  {{
    "type": "line|bar|scatter|pie",
    "title": "Human readable chart title",
    "xAxis": "column_name",
    "yAxis": "column_name_or_null"
  }}
]"""

    try:
        response_text = ask_gemini(prompt)
        if not response_text:
            return _heuristic_charts(df, schema, n_rows)

        # Strip markdown fences if present
        cleaned = response_text.strip()
        if '```' in cleaned:
            parts = cleaned.split('```')
            for p in parts:
                if '[' in p:
                    cleaned = p.strip()
                    if cleaned.startswith('json'):
                        cleaned = cleaned[4:].strip()
                    break

        chart_specs = json.loads(cleaned)

        # Build KPI cards from highest-variance continuous cols
        continuous = sorted(
            [c for c, m in schema.items() if m['type'] == 'continuous'],
            key=lambda c: schema[c].get('variance', 0), reverse=True
        )
        kpi_cards = []
        for col in continuous[:3]:
            total = df[col].sum()
            avg = df[col].mean()
            fmt_total = f"{total:,.0f}" if abs(total) < 1e9 else f"{total/1e6:,.1f}M"
            kpi_cards.append({
                'id': f'kpi_{col}',
                'title': col.replace('_', ' ').title(),
                'value': fmt_total,
                'trend': f"avg {avg:,.1f}",
                'column': col,
            })

        # Hydrate charts with actual data
        charts = []
        for i, spec in enumerate(chart_specs[:5]):
            chart_type = spec.get('type', 'bar')
            x_col = spec.get('xAxis')
            y_col = spec.get('yAxis')
            title = spec.get('title', f'Chart {i+1}')

            if not x_col or x_col not in df.columns:
                continue

            if chart_type == 'scatter' and y_col and y_col in df.columns:
                data = _build_scatter_data(df, x_col, y_col)
            elif chart_type == 'line' and y_col and y_col in df.columns:
                data = _build_timeseries_data(df, x_col, y_col)
            elif y_col and y_col in df.columns:
                data = _build_chart_data(df, x_col, y_col)
            else:
                data = _build_chart_data(df, x_col)

            if data:
                charts.append({
                    'id': f'chart_{i+1}',
                    'type': chart_type,
                    'title': title,
                    'xAxis': x_col,
                    'yAxis': y_col,
                    'data': data,
                })

        if charts:
            return kpi_cards, charts

    except Exception as e:
        print(f"[LLM chart engine error]: {e}")

    # Fallback to heuristic
    return _heuristic_charts(df, schema, n_rows)


@app.route('/api/auto-dashboard', methods=['POST'])
def auto_dashboard():
    """
    Zero-Click Auto-Visualization endpoint.
    Accepts JSON body: { data: [...], columns: [...], use_llm: bool }
    Returns a standardized Dashboard Configuration Object.
    """
    try:
        body = request.json
        records = body.get('data', [])
        columns = body.get('columns', [])
        use_llm = body.get('use_llm', True)  # Default: try LLM first

        if not records:
            return jsonify({'success': False, 'error': 'No data provided'})

        # Reconstruct DataFrame
        df = pd.DataFrame(records)
        if columns:
            existing = [c for c in columns if c in df.columns]
            df = df[existing]

        n_rows = len(df)
        cleaning_steps = []

        # ── Phase 1: Automated pre-cleaning ──────────────────────
        df, steps = _auto_clean(df)
        cleaning_steps.extend(steps)

        # Re-parse date columns that came in as strings
        for col in df.columns:
            if df[col].dtype == object:
                if any(kw in col.lower() for kw in TEMPORAL_KEYWORDS):
                    try:
                        parsed = pd.to_datetime(df[col], infer_datetime_format=True, errors='coerce')
                        if parsed.notna().mean() > 0.7:
                            df[col] = parsed
                    except Exception:
                        pass

        # ── Phase 1: Semantic Column Classification ───────────────
        schema = {}
        for col in df.columns:
            schema[col] = _classify_column(col, df[col], n_rows)

        # ── Phase 2: Chart Recommendation ────────────────────────
        if use_llm and model:
            kpi_cards, charts = _llm_charts(df, schema, n_rows)
        else:
            kpi_cards, charts = _heuristic_charts(df, schema, n_rows)

        # ── Phase 3: Dashboard Config Payload ────────────────────
        return jsonify({
            'success': True,
            'dashboard': {
                'kpi_cards': kpi_cards,
                'charts': charts,
                'schema': schema,
                'meta': {
                    'rows': n_rows,
                    'columns': list(df.columns),
                    'cleaning_steps': cleaning_steps,
                    'engine': 'llm' if (use_llm and model) else 'heuristic',
                }
            }
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': f'Auto-dashboard failed: {str(e)}'})



# ============================================================
# Feature 1: Natural Language Query → Chart (Chat-to-Chart)
# ============================================================
@app.route('/api/nl-query', methods=['POST'])
def nl_query():
    """
    Accepts: { question: str, data: [...], columns: [...] }
    Returns: { chart_config: {...}, sql_hint: str, insight: str }
    """
    try:
        body = request.json
        question = body.get('question', '').strip()
        records  = body.get('data', [])
        columns  = body.get('columns', [])

        if not question:
            return jsonify({'success': False, 'error': 'No question provided'})
        if not records:
            return jsonify({'success': False, 'error': 'No data provided'})

        df = pd.DataFrame(records)
        if columns:
            df = df[[c for c in columns if c in df.columns]]

        # Build schema description for the LLM
        schema_lines = []
        for col in df.columns:
            dtype = str(df[col].dtype)
            nuniq = df[col].nunique()
            sample = df[col].dropna().head(3).tolist()
            schema_lines.append(f"  - {col} (dtype={dtype}, unique={nuniq}, sample={sample})")
        schema_str = "\n".join(schema_lines)

        prompt = f"""You are a data visualization expert. The user has a dataset with these columns:
{schema_str}

User question: "{question}"

Respond ONLY with valid JSON (no markdown) in this format:
{{
  "chart_type": "bar" | "line" | "pie" | "scatter" | "area",
  "x_column": "<column name>",
  "y_column": "<column name or null>",
  "aggregation": "sum" | "mean" | "count" | "none",
  "title": "<short chart title>",
  "insight": "<one sentence analytical insight about this chart>",
  "sql_hint": "<a SQL SELECT query that would produce this chart data>"
}}

Pick the BEST chart type for the question. Only use columns that exist in the schema above."""

        chart_config = None
        insight_text = ""
        sql_hint = ""

        if model:
            response_text = ask_gemini(prompt)
            if response_text:
                try:
                    # Strip markdown code fences if present
                    clean = response_text.strip()
                    if clean.startswith('```'):
                        clean = clean.split('```')[1]
                        if clean.startswith('json'):
                            clean = clean[4:]
                    parsed = json.loads(clean.strip())
                    x_col = parsed.get('x_column')
                    y_col = parsed.get('y_column')
                    agg   = parsed.get('aggregation', 'sum')
                    ctype = parsed.get('chart_type', 'bar')
                    title = parsed.get('title', question)
                    insight_text = parsed.get('insight', '')
                    sql_hint = parsed.get('sql_hint', '')

                    # Build data
                    if x_col and x_col in df.columns:
                        if y_col and y_col in df.columns:
                            data = _build_chart_data(df, x_col, y_col, agg)
                        else:
                            data = _build_chart_data(df, x_col)
                        chart_config = {
                            'id': 'nl_chart',
                            'type': ctype,
                            'title': title,
                            'x': x_col,
                            'y': y_col,
                            'data': data,
                            'sql_hint': sql_hint,
                        }
                except Exception as parse_err:
                    print(f"[NL-Query JSON parse error]: {parse_err}")

        # Fallback: simple heuristic
        if not chart_config:
            q_lower = question.lower()
            num_cols = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]
            cat_cols = [c for c in df.columns if df[c].dtype == object and df[c].nunique() <= 20]
            x_col = cat_cols[0] if cat_cols else (num_cols[0] if num_cols else df.columns[0])
            y_col = num_cols[0] if num_cols else None
            ctype = 'bar'
            if any(kw in q_lower for kw in ['trend', 'over time', 'timeline']):
                ctype = 'line'
            elif 'distribution' in q_lower or 'breakdown' in q_lower:
                ctype = 'pie'
            data = _build_chart_data(df, x_col, y_col) if y_col else _build_chart_data(df, x_col)
            chart_config = {
                'id': 'nl_chart',
                'type': ctype,
                'title': question,
                'x': x_col,
                'y': y_col,
                'data': data,
                'sql_hint': f"SELECT {x_col}, SUM({y_col}) FROM table GROUP BY {x_col}" if y_col else f"SELECT {x_col}, COUNT(*) FROM table GROUP BY {x_col}",
            }
            insight_text = f"Showing {ctype} chart of {y_col or x_col} by {x_col}."

        return jsonify({
            'success': True,
            'chart_config': chart_config,
            'insight': insight_text,
            'sql_hint': sql_hint,
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)})


# ============================================================
# Feature 2: Anomaly Detection
# ============================================================
@app.route('/api/anomaly-detect', methods=['POST'])
def anomaly_detect():
    """
    Accepts: { data: [...], column: str, method: 'zscore'|'iqr' }
    Returns: { anomalies: [{index, value, reason}], stats: {...} }
    """
    try:
        body   = request.json
        records = body.get('data', [])
        column  = body.get('column', '')
        method  = body.get('method', 'zscore')

        if not records or not column:
            return jsonify({'success': False, 'error': 'data and column required'})

        df = pd.DataFrame(records)
        if column not in df.columns:
            return jsonify({'success': False, 'error': f'Column "{column}" not found'})

        series = pd.to_numeric(df[column], errors='coerce').dropna()

        if len(series) < 4:
            return jsonify({'success': False, 'error': 'Need at least 4 data points'})

        anomaly_indices = set()

        if method == 'zscore':
            mean = series.mean()
            std  = series.std()
            z_scores = ((series - mean) / std).abs()
            anomaly_indices = set(series[z_scores > 2.5].index.tolist())
            stats = {'mean': round(float(mean), 4), 'std': round(float(std), 4), 'threshold': '±2.5σ'}
        else:  # IQR
            Q1 = series.quantile(0.25)
            Q3 = series.quantile(0.75)
            IQR = Q3 - Q1
            lower = Q1 - 1.5 * IQR
            upper = Q3 + 1.5 * IQR
            anomaly_indices = set(series[(series < lower) | (series > upper)].index.tolist())
            stats = {'Q1': round(float(Q1), 4), 'Q3': round(float(Q3), 4),
                     'lower_bound': round(float(lower), 4), 'upper_bound': round(float(upper), 4)}

        # Build annotated data array
        enriched_data = []
        for i, row in df.iterrows():
            val = row.get(column)
            enriched_data.append({
                'index': i,
                'value': val,
                'is_anomaly': i in anomaly_indices,
            })

        anomalies = [
            {'index': d['index'], 'value': d['value'], 'reason': f'Statistical outlier ({method})'}
            for d in enriched_data if d['is_anomaly']
        ]

        return jsonify({
            'success': True,
            'column': column,
            'method': method,
            'anomaly_count': len(anomalies),
            'anomalies': anomalies,
            'stats': stats,
            'enriched_data': enriched_data,
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)})


# ============================================================
# Feature 3: Calculated Field Builder
# ============================================================
@app.route('/api/calc-field', methods=['POST'])
def calc_field():
    """
    Accepts: { data: [...], formula: str, new_column_name: str }
    Evaluates formula against the dataframe using pandas.eval().
    Returns: { data: [...], columns: [...] }
    """
    try:
        body       = request.json
        records    = body.get('data', [])
        formula    = body.get('formula', '').strip()
        new_col    = body.get('new_column_name', 'calc_field').strip()

        if not records or not formula:
            return jsonify({'success': False, 'error': 'data and formula required'})

        # Security: block dangerous keywords
        BLOCKED = ['import', 'exec', 'eval', 'open', 'os.', 'sys.', '__', 'subprocess', 'globals', 'locals']
        formula_lower = formula.lower()
        for blocked in BLOCKED:
            if blocked in formula_lower:
                return jsonify({'success': False, 'error': f'Formula contains blocked keyword: {blocked}'})

        df = pd.DataFrame(records)

        # Sanitize new_col name
        safe_name = ''.join(c if c.isalnum() or c == '_' else '_' for c in new_col)
        if not safe_name:
            safe_name = 'calc_field'

        # Evaluate with pandas.eval (safe subset of Python expressions)
        df[safe_name] = df.eval(formula)

        # Convert back to JSON-safe records
        result_records = json.loads(df.to_json(orient='records', date_format='iso'))

        return jsonify({
            'success': True,
            'new_column': safe_name,
            'formula': formula,
            'data': result_records,
            'columns': df.columns.tolist(),
            'preview': result_records[:5],
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': f'Formula error: {str(e)}'})


# ============================================================
# Feature 5: Transformation Lineage (re-apply pipeline)
# ============================================================
# In-memory store: session_id → { raw_data, pipeline_steps }
_lineage_store = {}

@app.route('/api/lineage/init', methods=['POST'])
def lineage_init():
    """Store raw data for lineage replay. Returns session_id."""
    import uuid
    body    = request.json
    records = body.get('data', [])
    columns = body.get('columns', [])
    if not records:
        return jsonify({'success': False, 'error': 'No data'})
    sid = str(uuid.uuid4())[:8]
    _lineage_store[sid] = {
        'raw': records,
        'raw_columns': columns,
        'steps': []  # list of { id, description, type, params }
    }
    return jsonify({'success': True, 'session_id': sid})


@app.route('/api/lineage/replay', methods=['POST'])
def lineage_replay():
    """
    Re-apply a modified pipeline. Accepts { session_id, steps: [...] }
    Returns { data, columns, steps_applied, cleaning_steps }
    """
    try:
        body = request.json
        sid  = body.get('session_id', '')
        steps_in = body.get('steps', [])

        if sid not in _lineage_store:
            return jsonify({'success': False, 'error': 'Session not found. Re-upload data.'})

        raw = _lineage_store[sid]['raw']
        df  = pd.DataFrame(raw)
        applied = []

        for step in steps_in:
            stype = step.get('type', '')
            try:
                if stype == 'drop_nulls':
                    col = step.get('column')
                    if col and col in df.columns:
                        df = df.dropna(subset=[col])
                        applied.append(f"Dropped rows with null in '{col}'")
                elif stype == 'fill_mean':
                    col = step.get('column')
                    if col and col in df.columns and pd.api.types.is_numeric_dtype(df[col]):
                        df[col] = df[col].fillna(df[col].mean())
                        applied.append(f"Filled nulls in '{col}' with mean")
                elif stype == 'fill_mode':
                    col = step.get('column')
                    if col and col in df.columns:
                        mode_val = df[col].mode().iloc[0] if len(df[col].mode()) > 0 else None
                        if mode_val is not None:
                            df[col] = df[col].fillna(mode_val)
                            applied.append(f"Filled nulls in '{col}' with mode '{mode_val}'")
                elif stype == 'drop_column':
                    col = step.get('column')
                    if col and col in df.columns:
                        df = df.drop(columns=[col])
                        applied.append(f"Dropped column '{col}'")
                elif stype == 'rename_column':
                    old = step.get('old_name')
                    new = step.get('new_name')
                    if old in df.columns and new:
                        df = df.rename(columns={old: new})
                        applied.append(f"Renamed '{old}' → '{new}'")
                elif stype == 'calc_field':
                    formula = step.get('formula', '')
                    new_col = step.get('new_column', 'calc')
                    BLOCKED = ['import', 'exec', 'eval', 'open', 'os.', 'sys.', '__']
                    if not any(b in formula.lower() for b in BLOCKED):
                        df[new_col] = df.eval(formula)
                        applied.append(f"Added calculated field '{new_col}' = {formula}")
            except Exception as step_err:
                applied.append(f"[SKIPPED] {stype}: {step_err}")
                continue

        result = json.loads(df.to_json(orient='records', date_format='iso'))
        return jsonify({
            'success': True,
            'data': result,
            'columns': df.columns.tolist(),
            'steps_applied': applied,
            'row_count': len(df),
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)})


# ============================================================
# Feature 7: Automated Text Insights (NLG)
# ============================================================
@app.route('/api/nlg-insight', methods=['POST'])
def nlg_insight():
    """
    Accepts: { chart_config: {...}, data: [...] }
    Returns: { insight: str }
    """
    try:
        body   = request.json
        config = body.get('chart_config', {})
        data   = body.get('data', config.get('data', []))

        if not data:
            return jsonify({'success': True, 'insight': 'No data to analyze.'})

        values = [d.get('value', d.get('y', 0)) for d in data if d.get('value') is not None or d.get('y') is not None]
        names  = [d.get('name', str(d.get('x', ''))) for d in data]

        if not values:
            return jsonify({'success': True, 'insight': 'Could not extract numeric values.'})

        max_val   = max(values)
        min_val   = min(values)
        total     = sum(values)
        avg       = total / len(values)
        max_label = names[values.index(max_val)] if names else 'N/A'
        min_label = names[values.index(min_val)] if names else 'N/A'

        # Try LLM first
        if model:
            prompt = f"""You are a data analyst writing a one-sentence insight for a business chart.
Chart title: "{config.get('title', 'Chart')}"
Chart type: {config.get('type', 'bar')}
Data summary: max={max_val:.2f} ({max_label}), min={min_val:.2f} ({min_label}), avg={avg:.2f}, total={total:.2f}, n={len(values)}
Write ONE concise analytical sentence (no jargon, no "the chart shows"). Focus on the most interesting pattern, trend, or outlier."""
            llm_resp = ask_gemini(prompt)
            if llm_resp:
                return jsonify({'success': True, 'insight': llm_resp.strip()})

        # Rule-based fallback
        title = config.get('title', 'This metric')
        pct_max = (max_val / total * 100) if total > 0 else 0
        if len(values) > 1:
            change = ((values[-1] - values[0]) / abs(values[0]) * 100) if values[0] != 0 else 0
            direction = "increased" if change > 0 else "decreased"
            insight = (
                f"{title}: {max_label} leads at {max_val:,.0f} ({pct_max:.1f}% of total), "
                f"while the overall trend has {direction} by {abs(change):.1f}% from start to end."
            )
        else:
            insight = f"{title} shows a peak of {max_val:,.0f} at {max_label} and a low of {min_val:,.0f} at {min_label}."

        return jsonify({'success': True, 'insight': insight})

    except Exception as e:
        return jsonify({'success': True, 'insight': 'Analysis complete.'})


# ============================================================
# Feature 9: SQL & Python Code Export
# ============================================================
@app.route('/api/code-export', methods=['POST'])
def code_export():
    """
    Accepts: { chart_config: {...}, table_name: str }
    Returns: { sql: str, python: str }
    """
    try:
        body    = request.json
        config  = body.get('chart_config', {})
        table   = body.get('table_name', 'your_table')
        x_col   = config.get('x', config.get('x_column', 'category'))
        y_col   = config.get('y', config.get('y_column', 'value'))
        agg     = config.get('aggregation', 'SUM').upper()
        ctype   = config.get('type', 'bar')
        title   = config.get('title', 'Chart')

        if agg == 'NONE':
            agg = 'SUM'

        # SQL
        if y_col:
            sql = (
                f"-- {title}\n"
                f"SELECT\n"
                f"    {x_col},\n"
                f"    {agg}({y_col}) AS {y_col}_{agg.lower()}\n"
                f"FROM {table}\n"
                f"GROUP BY {x_col}\n"
                f"ORDER BY {y_col}_{agg.lower()} DESC\n"
                f"LIMIT 20;"
            )
            python = (
                f"# {title}\n"
                f"import pandas as pd\n"
                f"import matplotlib.pyplot as plt\n\n"
                f"# Assuming df is your DataFrame\n"
                f"chart_data = df.groupby('{x_col}')['{y_col}'].{agg.lower()}().reset_index()\n"
                f"chart_data = chart_data.sort_values('{y_col}', ascending=False).head(20)\n\n"
                f"plt.figure(figsize=(10, 6))\n"
                f"plt.{ctype if ctype in ['bar', 'scatter'] else 'plot'}(chart_data['{x_col}'], chart_data['{y_col}'])\n"
                f"plt.title('{title}')\n"
                f"plt.xlabel('{x_col}')\n"
                f"plt.ylabel('{y_col}')\n"
                f"plt.tight_layout()\n"
                f"plt.show()"
            )
        else:
            sql = (
                f"-- {title}\n"
                f"SELECT\n"
                f"    {x_col},\n"
                f"    COUNT(*) AS count\n"
                f"FROM {table}\n"
                f"GROUP BY {x_col}\n"
                f"ORDER BY count DESC\n"
                f"LIMIT 20;"
            )
            python = (
                f"# {title}\n"
                f"import pandas as pd\n"
                f"import matplotlib.pyplot as plt\n\n"
                f"chart_data = df['{x_col}'].value_counts().head(20)\n\n"
                f"plt.figure(figsize=(10, 6))\n"
                f"chart_data.plot(kind='bar')\n"
                f"plt.title('{title}')\n"
                f"plt.tight_layout()\n"
                f"plt.show()"
            )

        return jsonify({'success': True, 'sql': sql, 'python': python})

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


# ============================================================
# Feature 10: Threshold Alerts (store/list/delete)
# ============================================================
_alerts_store = {}  # user_id → list of alert dicts

@app.route('/api/alerts', methods=['POST'])
def create_alert():
    """Create a threshold alert rule."""
    try:
        body     = request.json
        user_id  = body.get('user_id', 'anonymous')
        column   = body.get('column', '')
        operator = body.get('operator', '<')  # '<', '>', '<=', '>='
        threshold = float(body.get('threshold', 0))
        label    = body.get('label', f'{column} {operator} {threshold}')

        import uuid
        alert = {
            'id': str(uuid.uuid4())[:8],
            'user_id': user_id,
            'column': column,
            'operator': operator,
            'threshold': threshold,
            'label': label,
            'created_at': pd.Timestamp.now().isoformat(),
            'status': 'active',
        }
        _alerts_store.setdefault(user_id, []).append(alert)
        return jsonify({'success': True, 'alert': alert})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/alerts/<user_id>', methods=['GET'])
def list_alerts(user_id):
    return jsonify({'success': True, 'alerts': _alerts_store.get(user_id, [])})


@app.route('/api/alerts/<user_id>/<alert_id>', methods=['DELETE'])
def delete_alert(user_id, alert_id):
    alerts = _alerts_store.get(user_id, [])
    _alerts_store[user_id] = [a for a in alerts if a['id'] != alert_id]
    return jsonify({'success': True})


@app.route('/api/alerts/check', methods=['POST'])
def check_alerts():
    """Check current data against alert rules and return triggered ones."""
    try:
        body    = request.json
        user_id = body.get('user_id', 'anonymous')
        records = body.get('data', [])
        if not records:
            return jsonify({'success': True, 'triggered': []})

        df = pd.DataFrame(records)
        alerts = _alerts_store.get(user_id, [])
        triggered = []

        OPS = {'<': lambda a, b: a < b, '>': lambda a, b: a > b,
               '<=': lambda a, b: a <= b, '>=': lambda a, b: a >= b, '==': lambda a, b: a == b}

        for alert in alerts:
            col = alert['column']
            if col not in df.columns:
                continue
            series = pd.to_numeric(df[col], errors='coerce').dropna()
            if series.empty:
                continue
            current_val = float(series.iloc[-1])
            op_fn = OPS.get(alert['operator'], lambda a, b: False)
            if op_fn(current_val, alert['threshold']):
                triggered.append({
                    **alert,
                    'current_value': current_val,
                    'message': f"Alert: {col} is {current_val:.2f} (rule: {col} {alert['operator']} {alert['threshold']})",
                })

        return jsonify({'success': True, 'triggered': triggered})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


# ============================================================
# Feature 8: Collaborative Annotations (in-memory)
# ============================================================
_annotations_store = {}  # dashboard_id → list of annotation dicts

@app.route('/api/annotations', methods=['POST'])
def save_annotation():
    """Save a chart annotation."""
    try:
        import uuid
        body         = request.json
        dashboard_id = body.get('dashboard_id', 'default')
        annotation = {
            'id':           str(uuid.uuid4())[:8],
            'chart_id':     body.get('chart_id', ''),
            'x_value':      body.get('x_value', ''),
            'y_value':      body.get('y_value', None),
            'user_id':      body.get('user_id', 'anonymous'),
            'user_name':    body.get('user_name', 'User'),
            'text':         body.get('text', ''),
            'created_at':   pd.Timestamp.now().isoformat(),
        }
        _annotations_store.setdefault(dashboard_id, []).append(annotation)
        return jsonify({'success': True, 'annotation': annotation})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/annotations/<dashboard_id>', methods=['GET'])
def get_annotations(dashboard_id):
    return jsonify({'success': True, 'annotations': _annotations_store.get(dashboard_id, [])})


@app.route('/api/annotations/<dashboard_id>/<annotation_id>', methods=['DELETE'])
def delete_annotation(dashboard_id, annotation_id):
    anns = _annotations_store.get(dashboard_id, [])
    _annotations_store[dashboard_id] = [a for a in anns if a['id'] != annotation_id]
    return jsonify({'success': True})


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
