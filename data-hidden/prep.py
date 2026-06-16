import pandas as pd
import geopandas as gpd
from supabase import create_client, Client
import os
from typing import Dict, Any
import numpy as np
from sodapy import Socrata

# Configuration parameters
# This will upload data into the 'Housing' project in Supabase
SUPABASE_URL = 'https://wakzcuklgwutdvyzptuv.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indha3pjdWtsZ3d1dGR2eXpwdHV2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTYwNzk0NywiZXhwIjoyMDcxMTgzOTQ3fQ.XeQIbq6xRusXVa7PyXsHjQg3Yl4KHD4bvSHuNYr_A6M'
Fulton_app_token = '5kaWjTIkbWwaIZLWbkN7idLow'

def clear_and_upload_to_supabase(df: pd.DataFrame, table_name: str, supabase: Client) -> bool:
    """
    Clear a Supabase table and upload new data from a DataFrame
    """
    try:
        # Clear existing data
        print(f"Clearing existing data from {table_name}...")
        delete_response = supabase.table(table_name).delete().neq('id', '').execute()
        print(f"Cleared {table_name}")
        
        # Convert DataFrame to list of dictionaries
        data_to_insert = df.to_dict('records')
        
        # Insert new data in batches (Supabase has a limit on batch size)
        batch_size = 1000
        total_rows = len(data_to_insert)
        
        print(f"Uploading {total_rows} rows to {table_name}...")
        
        for i in range(0, total_rows, batch_size):
            batch = data_to_insert[i:i + batch_size]
            response = supabase.table(table_name).insert(batch).execute()
            print(f"Uploaded batch {i//batch_size + 1} ({len(batch)} rows) to {table_name}")
        
        print(f"Successfully uploaded all data to {table_name}")
        return True
        
    except Exception as e:
        print(f"Error uploading to {table_name}: {str(e)}")
        return False

def main():
    # Initialize Supabase client
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Read data from Fulton County API endpoint
    client = Socrata(
        "sharefulton.fultoncountyga.gov", 
        '5kaWjTIkbWwaIZLWbkN7idLow',
        username="wwright@atlantaregional.org",
        password="A1Furman518%!*"
    )

    results = client.get("qh59-mhjw", limit=250000)

    df = pd.DataFrame.from_records(results)

    # Only keep rows where tractid is not NaN
    df = df[df['tractid'].notna()]

    # only keep rows where filedat is greater than or equal to 2020-01-01
    df['filedate'] = pd.to_datetime(df['filedate'])
    df = df[df['filedate'] >= '2016-01-01']

    # create column called 'filemonth' that takes the 2-digit year and 2-digit month and concatenates them
    df['year'] = df['filedate'].dt.year
    df['month'] = df['filedate'].dt.month
    df['filemonth'] = df['year'].astype(str) + '-' + df['month'].astype(str).str.zfill(2)
    df['totalfilings'] = pd.to_numeric(df['totalfilings'], errors='coerce')

    # create a summary of eviction data that groups by 'filemonth' and 'tractid' and sums up 'totalfilings'
    eviction_summary = df.groupby(['filemonth', 'tractid']).agg({'totalfilings': 'sum'}).reset_index()

    # re-create the month and year columns from the filemonth column
    eviction_summary['year'] = eviction_summary['filemonth'].str[:4]
    eviction_summary['month'] = eviction_summary['filemonth'].str[-2:]

    # sort eviction_summary by 'year' and 'month'
    eviction_summary = eviction_summary.sort_values(by=['year', 'month'])

    # create 'id' column that concatenates 'filemonth' and 'tractid'
    eviction_summary['id'] = eviction_summary['filemonth'] + '-' + eviction_summary['tractid'].astype(str)

    # read in the renter-occupied housing units from csv
    renter_HUs = pd.read_csv('renters-tract.csv', dtype={'tractid': str})

    # merge the eviction_summary and renter_HUs on 'tractid'
    eviction_summary = eviction_summary.merge(renter_HUs, on='tractid', how='left')

    # rename the renter_occ_HU_2023 column to 'renter_occ_HU_2023'
    eviction_summary = eviction_summary.rename(columns={'renter_occ_HU_2023': 'renter_HUs'})

    # cast renter_HUs and totalfilings to integers
    eviction_summary['renter_HUs'] = eviction_summary['renter_HUs'].astype(int)
    eviction_summary['totalfilings'] = eviction_summary['totalfilings'].astype(int)

    # create a column called 'filing-rate' that is the ratio of 'totalfilings' to 'renter_HUs'
    eviction_summary['filing-rate'] = eviction_summary['totalfilings'] / eviction_summary['renter_HUs'] * 100

    # Replace infinite values with None (becomes NULL in Supabase)
    eviction_summary['filing-rate'] = eviction_summary['filing-rate'].replace([np.inf, -np.inf], None)

    eviction_tract_summary = eviction_summary[[
        'id',
        'filemonth',
        'tractid',
        'renter_HUs',
        'totalfilings',
        'filing-rate'
    ]]

    # ensure totalfilings is an integer
    eviction_tract_summary = eviction_tract_summary.copy()
    eviction_tract_summary['totalfilings'] = pd.to_numeric(eviction_tract_summary['totalfilings'], errors='coerce')

    # create eviction_month_summary that groups by 'filemonth' and sums up 'totalfilings'
    eviction_month_summary = eviction_tract_summary.groupby(['filemonth']).agg({'totalfilings': 'sum'}).reset_index()
    eviction_month_summary['id'] = eviction_month_summary['filemonth']

    # re-create the month and year columns from the filemonth column
    eviction_month_summary['year'] = eviction_month_summary['filemonth'].str[:4]
    eviction_month_summary['month'] = eviction_month_summary['filemonth'].str[-2:]

    # sort eviction_month_summary by 'year' and 'month'
    eviction_month_summary = eviction_month_summary.sort_values(by=['year', 'month'])

    eviction_month_summary = eviction_month_summary[['id', 'filemonth', 'totalfilings']]

    # output both to CSV before uploading to Supabase
    eviction_tract_summary.to_csv('eviction_tract_summary.csv', index=False)
    eviction_month_summary.to_csv('eviction_month_summary.csv', index=False)
    
    # Upload to Supabase (replace 'eviction_tract_summary' and 'eviction_month_summary' with your actual table names)
    tract_success = clear_and_upload_to_supabase(eviction_tract_summary, 'evictions-tract', supabase)
    month_success = clear_and_upload_to_supabase(eviction_month_summary, 'evictions-month', supabase)
    
    if tract_success and month_success:
        print("All data successfully uploaded to Supabase!")
    else:
        print("Some uploads failed. Check the error messages above.")

if __name__ == "__main__":
    main()