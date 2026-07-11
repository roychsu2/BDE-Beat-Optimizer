import os
import pandas as pd
import numpy as np
import random

# Create templates directory
os.makedirs("templates", exist_ok=True)

# Generate 120 mock records around Barasat/Kolkata
np.random.seed(42)
random.seed(42)
n_records = 120

lat_base = 22.72
lon_base = 88.48

# Create random coordinates with normal distribution
lats = lat_base + np.random.normal(0, 0.05, n_records)
lons = lon_base + np.random.normal(0, 0.05, n_records)

customer_types = ["CHEMIST", "Stockist C2D", "Stockist D2R", "Stockist C2D/Stockist D2R"]
type_choices = np.random.choice(customer_types, n_records, p=[0.6, 0.15, 0.15, 0.10])

# Clean names list
names = []
chemist_idx = 1
stockist_idx = 1
for t in type_choices:
    if t == "CHEMIST":
        names.append(f"Chemist Pharmacy {chemist_idx}")
        chemist_idx += 1
    else:
        names.append(f"Stockist Distributor Hub {stockist_idx}")
        stockist_idx += 1

mobiles = [str(random.randint(7000000000, 9999999999)) for _ in range(n_records)]
# Create some duplicates to simulate hybrid node grouping
for i in range(10):
    mobiles[i + 20] = mobiles[i]
    lats[i + 20] = lats[i] + 0.00001
    lons[i + 20] = lons[i] + 0.00001

lat_longs = [f"{lat:.7f},{lon:.7f}" for lat, lon in zip(lats, lons)]

mock_data = {
    "Employee Name": ["Raja Das"] * n_records,
    "Employee Code": [100964] * n_records,
    "Head Quarter": ["Kolkata"] * n_records,
    "Customer Name": names,
    "Code": [f"B-CODE{1000+i}" for i in range(n_records)],
    "Customer Type": type_choices,
    "Class": np.random.choice(["A", "B", "C"], n_records, p=[0.2, 0.5, 0.3]),
    "Person": [f"Contact Person {i}" for i in range(n_records)],
    "Area": np.random.choice(["BARASAT", "KOLKATA", "HABRA", "BARRACKPORE"], n_records),
    "Mobile": mobiles,
    "Shop Address": [f"Street No {i}, Area Road" for i in range(n_records)],
    "PIN Code": np.random.choice([700124, 700126, 743201, 500079], n_records),
    "LAT LONG": lat_longs
}

df = pd.DataFrame(mock_data)
df.to_excel("templates/beat_planning_template.xlsx", index=False)
print("Updated larger 120-record single-file template generated at templates/beat_planning_template.xlsx")
