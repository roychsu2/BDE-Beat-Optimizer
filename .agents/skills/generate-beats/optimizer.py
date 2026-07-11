import os
import sys
import argparse
import pandas as pd
import numpy as np
from sklearn.cluster import KMeans
import folium

def parse_args():
    parser = argparse.ArgumentParser(description="Capacitated 24-Beat monthly optimizer for Pharmarack BDE team.")
    parser.add_argument("input_path", help="Path to the input Excel or CSV beat planning sheet")
    parser.add_argument("output_path", help="Path for the output Excel or CSV file")
    return parser.parse_args()

def clean_and_normalize(df):
    df = df.copy()
    
    # Required columns map
    required_cols = [
        "Employee Name", "Employee Code", "Head Quarter", "Customer Name", 
        "Code", "Customer Type", "Class", "Person", "Area", "Mobile", 
        "Shop Address", "PIN Code", "LAT LONG"
    ]
    
    for col in required_cols:
        if col not in df.columns:
            df[col] = np.nan
            
    # Clean mobile
    df['mobile_clean'] = df['Mobile'].astype(str).str.replace(r'\D+', '', regex=True).str.strip()
    df.loc[df['mobile_clean'].isin(['', 'nan', 'NaN', '0']), 'mobile_clean'] = ''
    
    # Clean address
    df['address_clean'] = df['Shop Address'].astype(str).str.lower().str.replace(r'[^a-z0-9]', '', regex=True).str.strip()
    df.loc[df['address_clean'].isin(['', 'nan', 'NaN']), 'address_clean'] = ''
    
    # Parse LAT LONG column
    df['latitude'] = 0.0
    df['longitude'] = 0.0
    df['is_imputed'] = True
    
    for idx, row in df.iterrows():
        lat_long_str = str(row['LAT LONG']).strip()
        if lat_long_str and ',' in lat_long_str:
            try:
                parts = lat_long_str.split(',')
                parsed_lat = float(parts[0].strip())
                parsed_lon = float(parts[1].strip())
                if parsed_lat != 0.0 and parsed_lon != 0.0:
                    df.loc[idx, 'latitude'] = parsed_lat
                    df.loc[idx, 'longitude'] = parsed_lon
                    df.loc[idx, 'is_imputed'] = False
            except ValueError:
                pass
                
    # PIN Code fallback lookup
    # 1. Compute average coordinates per PIN code from real coordinates
    valid_coords_df = df[df['is_imputed'] == False]
    pin_coords = valid_coords_df.groupby('PIN Code').agg({
        'latitude': 'mean',
        'longitude': 'mean'
    }).to_dict('index')
    
    # Compute overall center of dataset as absolute fallback
    if len(valid_coords_df) > 0:
        overall_center_lat = valid_coords_df['latitude'].mean()
        overall_center_lon = valid_coords_df['longitude'].mean()
    else:
        overall_center_lat = 22.5726
        overall_center_lon = 88.3639
        
    # 2. Impute missing coordinates using PIN Code averages
    imputed_count = 0
    for idx, row in df.iterrows():
        if row['is_imputed']:
            pin = row['PIN Code']
            if pd.notna(pin) and pin in pin_coords:
                df.loc[idx, 'latitude'] = pin_coords[pin]['latitude']
                df.loc[idx, 'longitude'] = pin_coords[pin]['longitude']
                imputed_count += 1
            else:
                df.loc[idx, 'latitude'] = overall_center_lat
                df.loc[idx, 'longitude'] = overall_center_lon
                imputed_count += 1
                
    if imputed_count > 0:
        print(f"PIN Code Fallback: Imputed coordinates for {imputed_count} records using PIN code averages or overall center.")
                
    # BDE Call Weights based on KPI rules:
    df['call_weight'] = 1  
    for idx, row in df.iterrows():
        cust_type = str(row['Customer Type']).upper()
        if 'STOCKIST' in cust_type:
            if 'CHEMIST' in cust_type or 'RETAILER' in cust_type:
                df.loc[idx, 'call_weight'] = 3
            else:
                df.loc[idx, 'call_weight'] = 2
                
    return df

def build_unique_nodes(df_all):
    df_all = df_all.reset_index(drop=True)
    df_all['node_id'] = -1
    
    current_node_id = 0
    for idx, row in df_all.iterrows():
        if df_all.loc[idx, 'node_id'] != -1:
            continue
            
        lat, lon = row['latitude'], row['longitude']
        mobile = row['mobile_clean']
        address = row['address_clean']
        is_imputed = row['is_imputed']
        
        # Build query mask for matching
        mask = (df_all['node_id'] == -1)
        
        # Only group by coordinates if BOTH rows are not imputed coordinates!
        coord_match = (is_imputed == False) & (df_all['is_imputed'] == False) & (lat != 0.0) & (lon != 0.0) & (np.isclose(df_all['latitude'], lat, atol=1e-5)) & (np.isclose(df_all['longitude'], lon, atol=1e-5))
        mobile_match = (mobile != '') & (df_all['mobile_clean'] == mobile)
        address_match = (address != '') & (df_all['address_clean'] == address)
        
        final_match = coord_match | mobile_match | address_match
        
        matched_indices = df_all[mask & final_match].index
        
        if len(matched_indices) > 0:
            df_all.loc[matched_indices, 'node_id'] = current_node_id
            current_node_id += 1
        else:
            df_all.loc[idx, 'node_id'] = current_node_id
            current_node_id += 1
            
    # Aggregate physical nodes for clustering, sum call weights
    nodes = df_all.groupby('node_id').agg({
        'latitude': 'mean',
        'longitude': 'mean',
        'call_weight': 'sum',
        'Code': lambda x: ';'.join(x.astype(str).unique()),
        'Customer Name': lambda x: ' / '.join(x.astype(str).unique()),
        'Customer Type': lambda x: ';'.join(x.astype(str).unique()),
        'Mobile': lambda x: ';'.join(x.dropna().astype(str).unique()),
        'Shop Address': lambda x: ' | '.join(x.dropna().astype(str).unique())
    }).reset_index()
    
    return df_all, nodes

def balance_clusters(nodes, initial_assignments, centroids, n_clusters, max_iters=300):
    assignments = initial_assignments.copy()
    
    # Calculate average call weight to adapt cap boundaries dynamically if dataset is extremely high weight
    total_weight = nodes['call_weight'].sum()
    avg_weight = total_weight / n_clusters
    target_min = max(20, int(np.floor(avg_weight - 3)))
    target_max = max(25, int(np.ceil(avg_weight + 3)))

    for _ in range(max_iters):
        weights = np.zeros(n_clusters)
        for idx, row in nodes.iterrows():
            cluster_id = assignments[idx]
            weights[cluster_id] += row['call_weight']
            
        max_c = np.argmax(weights)
        min_c = np.argmin(weights)
        
        is_min_ok = weights[min_c] >= target_min
        is_max_ok = weights[max_c] <= target_max
        if (is_min_ok and is_max_ok) or (weights[max_c] - weights[min_c] <= 3):
            break
            
        max_c_nodes = nodes[assignments == max_c]
        best_node_to_move = None
        best_target_cluster = None
        min_distance_increase = float('inf')
        
        for node_idx, node in max_c_nodes.iterrows():
            current_centroid = centroids[max_c]
            for c_idx in range(n_clusters):
                if weights[c_idx] < target_max:
                    dist_to_target = np.sqrt((node['latitude'] - centroids[c_idx][0])**2 + (node['longitude'] - centroids[c_idx][1])**2)
                    dist_to_current = np.sqrt((node['latitude'] - current_centroid[0])**2 + (node['longitude'] - current_centroid[1])**2)
                    
                    dist_increase = dist_to_target - dist_to_current
                    if dist_increase < min_distance_increase:
                        min_distance_increase = dist_increase
                        best_node_to_move = node_idx
                        best_target_cluster = c_idx
                        
        if best_node_to_move is not None:
            assignments[best_node_to_move] = best_target_cluster
            for c in range(n_clusters):
                c_nodes = nodes[assignments == c]
                if len(c_nodes) > 0:
                    centroids[c] = [c_nodes['latitude'].mean(), c_nodes['longitude'].mean()]
        else:
            break
            
    return assignments, centroids

def solve_tsp(day_nodes_df):
    if len(day_nodes_df) <= 1:
        day_nodes_df = day_nodes_df.copy()
        day_nodes_df['sequence_number'] = 1
        return day_nodes_df
        
    unvisited = day_nodes_df.copy().to_dict('records')
    path = []
    
    current_idx = 0
    for i in range(1, len(unvisited)):
        if unvisited[i]['longitude'] < unvisited[current_idx]['longitude']:
            current_idx = i
            
    current = unvisited.pop(current_idx)
    current['sequence_number'] = 1
    path.append(current)
    
    seq = 2
    while len(unvisited) > 0:
        nearest_idx = 0
        min_dist = float('inf')
        
        for i in range(len(unvisited)):
            dist = (current['latitude'] - unvisited[i]['latitude'])**2 + (current['longitude'] - unvisited[i]['longitude'])**2
            if dist < min_dist:
                min_dist = dist
                nearest_idx = i
                
        current = unvisited.pop(nearest_idx)
        current['sequence_number'] = seq
        path.append(current)
        seq += 1
        
    return pd.DataFrame(path)

def main():
    args = parse_args()
    
    if not os.path.exists(args.input_path):
        print(f"Error: Input path does not exist: {args.input_path}")
        sys.exit(1)
        
    print("Loading data...")
    try:
        if args.input_path.endswith('.csv'):
            df = pd.read_csv(args.input_path)
        else:
            df = pd.read_excel(args.input_path)
    except Exception as e:
        print(f"Error reading input file: {e}")
        sys.exit(1)
        
    print("Normalizing data & applying PIN code fallbacks...")
    df_all = clean_and_normalize(df)
    
    print("Identifying hybrid and unique nodes...")
    df_all, nodes = build_unique_nodes(df_all)
    
    print(f"Combined {len(df_all)} records into {len(nodes)} unique physical stops.")
    
    # Filter out invalid coordinates for clustering
    valid_coords = (nodes['latitude'] != 0.0) & (nodes['longitude'] != 0.0)
    cluster_nodes = nodes[valid_coords].copy()
    
    if len(cluster_nodes) == 0:
        print("Error: No valid coordinates found for clustering.")
        sys.exit(1)
        
    print("Clustering stops into 24 daily beats (4 weeks * 6 days)...")
    n_clusters = min(24, len(cluster_nodes))
    
    # Check if number of unique coordinates is less than 24
    unique_coords_count = len(cluster_nodes.groupby(['latitude', 'longitude']))
    
    if unique_coords_count < n_clusters:
        print(f"Unique coordinates count ({unique_coords_count}) is less than required beats ({n_clusters}). Using round-robin sequential fallback assignment.")
        balanced_labels = np.arange(len(cluster_nodes)) % n_clusters
        balanced_centroids = []
        for c in range(n_clusters):
            c_nodes = cluster_nodes[balanced_labels == c]
            if len(c_nodes) > 0:
                balanced_centroids.append([c_nodes['latitude'].mean(), c_nodes['longitude'].mean()])
            else:
                balanced_centroids.append([22.5726, 88.3639])
    else:
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        cluster_labels = kmeans.fit_predict(cluster_nodes[['latitude', 'longitude']])
        centroids = list(kmeans.cluster_centers_)
        
        balanced_labels, balanced_centroids = balance_clusters(
            cluster_nodes, cluster_labels, centroids, n_clusters
        )
        
    cluster_nodes['cluster'] = balanced_labels
    
    center_lat = cluster_nodes['latitude'].mean()
    center_lon = cluster_nodes['longitude'].mean()
    
    centroids_np = np.array(balanced_centroids)
    angles = []
    for idx, (c_lat, c_lon) in enumerate(centroids_np):
        angle = np.arctan2(c_lat - center_lat, c_lon - center_lon)
        angles.append((angle, idx))
        
    angles.sort()
    cluster_order = [idx for angle, idx in angles]
    
    week_names = ["Week 1", "Week 2", "Week 3", "Week 4"]
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    
    cluster_to_week = {}
    cluster_to_day = {}
    for i, cluster_idx in enumerate(cluster_order):
        week_num = i // 6
        day_num = i % 6
        cluster_to_week[cluster_idx] = week_names[min(week_num, len(week_names)-1)]
        cluster_to_day[cluster_idx] = day_names[day_num]
        
    cluster_nodes['week'] = cluster_nodes['cluster'].map(cluster_to_week).fillna('Week 1')
    cluster_nodes['beat_day'] = cluster_nodes['cluster'].map(cluster_to_day).fillna('Monday')
    
    sequenced_list = []
    for wk in week_names:
        for day in day_names:
            day_nodes = cluster_nodes[(cluster_nodes['week'] == wk) & (cluster_nodes['beat_day'] == day)]
            if len(day_nodes) > 0:
                sequenced_df = solve_tsp(day_nodes)
                sequenced_list.append(sequenced_df)
                
    cluster_nodes_sequenced = pd.concat(sequenced_list, ignore_index=True)
    
    zero_nodes = nodes[~valid_coords].copy()
    if len(zero_nodes) > 0:
        print(f"Warning: {len(zero_nodes)} nodes had invalid/missing coordinates and were assigned to Week 1 Monday.")
        zero_nodes['week'] = 'Week 1'
        zero_nodes['beat_day'] = 'Monday'
        zero_nodes['cluster'] = -1
        zero_nodes['sequence_number'] = 99
        nodes_final = pd.concat([cluster_nodes_sequenced, zero_nodes], ignore_index=True)
    else:
        nodes_final = cluster_nodes_sequenced
        
    df_all = df_all.merge(nodes_final[['node_id', 'week', 'beat_day', 'cluster', 'sequence_number']], on='node_id', how='left')
    
    # Fill any NaN week or day values with default fallback
    df_all['week'] = df_all['week'].fillna('Week 1')
    df_all['beat_day'] = df_all['beat_day'].fillna('Monday')
    df_all['sequence_number'] = df_all['sequence_number'].fillna(99).astype(int)
    
    output_df = df_all.drop(columns=['mobile_clean', 'address_clean', 'latitude', 'longitude', 'is_imputed'])
    
    day_sort_order = { 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6 }
    week_sort_order = { 'Week 1': 1, 'Week 2': 2, 'Week 3': 3, 'Week 4': 4 }
    output_df['week_sort'] = output_df['week'].map(week_sort_order)
    output_df['day_sort'] = output_df['beat_day'].map(day_sort_order)
    output_df = output_df.sort_values(by=['week_sort', 'day_sort', 'sequence_number']).drop(columns=['week_sort', 'day_sort'])
    
    print(f"Saving optimized route data to {args.output_path}...")
    output_dir = os.path.dirname(args.output_path)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)
        
    if args.output_path.endswith('.csv'):
        output_df.to_csv(args.output_path, index=False)
    else:
        output_df.to_excel(args.output_path, index=False)
        
    print("Generating interactive HTML route map...")
    day_colors = {
        'Monday': 'blue',
        'Tuesday': 'green',
        'Wednesday': 'red',
        'Thursday': 'purple',
        'Friday': 'orange',
        'Saturday': 'pink'
    }
    
    m = folium.Map(location=[center_lat, center_lon], zoom_start=12)
    for idx, row in nodes_final.iterrows():
        lat, lon = row['latitude'], row['longitude']
        if lat == 0.0 or lon == 0.0:
            continue
            
        week = row['week']
        day = row['beat_day']
        color = day_colors.get(day, 'gray')
        
        popup_html = f"""
        <b>Stop #{row['sequence_number']}:</b> {row['Customer Name']}<br/>
        <b>Code:</b> {row['Code']}<br/>
        <b>Type:</b> {row['Customer Type']}<br/>
        <b>Address:</b> {row['Shop Address']}<br/>
        <b>Call Weight:</b> {row['call_weight']}<br/>
        <b>Schedule:</b> {week} - {day}
        """
        
        folium.Marker(
            location=[lat, lon],
            popup=folium.Popup(popup_html, max_width=300),
            icon=folium.Icon(color=color, icon='info-sign')
        ).add_to(m)
        
    for wk in week_names:
        for day in day_names:
            day_nodes = nodes_final[(nodes_final['week'] == wk) & (nodes_final['beat_day'] == day)].sort_values(by='sequence_number')
            coords = day_nodes[['latitude', 'longitude']].values.tolist()
            if len(coords) > 1:
                folium.PolyLine(
                    coords,
                    color=day_colors.get(day, 'blue'),
                    weight=3,
                    opacity=0.6,
                    dash_array='5, 10'
                ).add_to(m)
                
    legend_html = f"""
     <div style="position: fixed; 
     bottom: 50px; left: 50px; width: 160px; height: 160px; 
     border:2px solid grey; z-index:9999; font-size:14px;
     background-color:white; opacity: 0.9; padding: 10px;
     border-radius: 5px;">
     <b>Schedule Days</b><br/>
     &nbsp; <i class="fa fa-map-marker fa-1x" style="color:blue"></i> Mon<br/>
     &nbsp; <i class="fa fa-map-marker fa-1x" style="color:green"></i> Tue<br/>
     &nbsp; <i class="fa fa-map-marker fa-1x" style="color:red"></i> Wed<br/>
     &nbsp; <i class="fa fa-map-marker fa-1x" style="color:purple"></i> Thu<br/>
     &nbsp; <i class="fa fa-map-marker fa-1x" style="color:orange"></i> Fri<br/>
     &nbsp; <i class="fa fa-map-marker fa-1x" style="color:pink"></i> Sat<br/>
     </div>
     """
    m.get_root().html.add_child(folium.Element(legend_html))
    
    map_dir = "data"
    os.makedirs(map_dir, exist_ok=True)
    map_path = os.path.join(map_dir, "route_map.html")
    m.save(map_path)
    print(f"Interactive map successfully saved to {map_path}")
    print("Optimization completed successfully!")

if __name__ == '__main__':
    main()
