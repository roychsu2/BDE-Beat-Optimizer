---
name: generate-beats
description: Optimize and generate patch-based daily beats (Mon-Fri) for Pharmarack BDE team from C2D and D2R CSV files.
---

# Generate Beats Skill

This skill groups distributor (C2D) and retailer (D2R) visit points into optimized geographic clusters representing daily beats from Monday to Friday.

## Requirements

The input CSV files must have the following column headers:
- `latitude` (Float, mandatory for mapping/clustering)
- `longitude` (Float, mandatory for mapping/clustering)
- `id` (String/Int, unique identifier)
- `name` (String, display name)
- `address` (String, used for hybrid node deduplication)
- `mobile` (String, used for hybrid node deduplication)

## Usage

Run the python script directly with paths to the datasets and the desired output path:

```bash
python .agents/skills/generate-beats/optimizer.py <path_to_c2d_csv> <path_to_d2r_csv> <path_to_output_csv>
```

This will:
1. Combine and deduplicate records into visit nodes.
2. Cluster them into Mon-Fri BDE travel patches.
3. Save the results to the specified output CSV path.
4. Output an interactive map at `data/route_map.html`.
