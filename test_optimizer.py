import unittest
import pandas as pd
import numpy as np # type: ignore
import os
import sys

# Add the directory containing optimizer.py to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '.agents', 'skills', 'generate-beats')))
import optimizer # type: ignore

class TestOptimizerGrouping(unittest.TestCase):
    def test_clean_and_normalize_head_quarter(self):
        data = {
            'Employee Name': ['Emp1', 'Emp1'],
            'Code': ['C1', 'C2'],
            'Customer Name': ['Cust1', 'Cust2'],
            'Head Quarter': ['Banaras', 'Mirzapur'],
            'LAT LONG': ['25.3176,82.9739', '25.1337,82.5644'],
            'Customer Type': ['Retailer', 'Retailer']
        }
        df = pd.DataFrame(data)
        cleaned = optimizer.clean_and_normalize(df)
        self.assertEqual(cleaned.iloc[0]['Head Quarter'], 'Banaras')
        self.assertEqual(cleaned.iloc[1]['Head Quarter'], 'Mirzapur')

    def test_build_unique_nodes_preserves_head_quarter(self):
        data = {
            'Employee Name': ['Emp1', 'Emp1'],
            'Code': ['C1', 'C2'],
            'Customer Name': ['Cust1', 'Cust2'],
            'Head Quarter': ['Banaras', 'Banaras'],
            'LAT LONG': ['25.3176,82.9739', '25.3176,82.9739'],
            'Customer Type': ['Retailer', 'Retailer'],
            'Mobile': ['123', '123'],
            'Shop Address': ['A', 'A']
        }
        df = pd.DataFrame(data)
        cleaned = optimizer.clean_and_normalize(df)
        df_all, nodes = optimizer.build_unique_nodes(cleaned)
        
        self.assertEqual(len(nodes), 1)
        self.assertEqual(nodes.iloc[0]['Head Quarter'], 'Banaras')

if __name__ == '__main__':
    unittest.main()
