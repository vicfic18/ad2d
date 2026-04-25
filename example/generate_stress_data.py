import csv
import random

def generate_stress_data(filename="stress_test_data.csv", num_rows=1000):
    fieldnames = ['ID', 'NAME', 'DATE', 'WORKSHOP', 'ISSUER']
    
    names = ["John Doe", "Jane Smith", "Robert Brown", "Emily White", "Michael Davis", "Susan Wilson", "David Miller", "Linda Taylor", "Chris Evans", "Jessica Alba"]
    workshops = ["Web Development", "Quantum Computing", "Artificial Intelligence", "UI/UX Design", "Data Science", "Cyber Security"]
    issuers = ["Tech Academy", "Advanced Lab", "DeepMind Insights", "Design Hub", "Science Corp"]
    dates = ["2026-05-10", "2026-05-11", "2026-05-12", "2026-06-01", "2026-06-15"]

    with open(filename, mode='w', newline='') as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        
        for i in range(1, num_rows + 1):
            writer.writerow({
                'ID': f"CERT-{10000 + i}",
                'NAME': random.choice(names) + f" {i}",
                'DATE': random.choice(dates),
                'WORKSHOP': random.choice(workshops),
                'ISSUER': random.choice(issuers)
            })

    print(f"Successfully generated {num_rows} rows in {filename}")

if __name__ == "__main__":
    generate_stress_data(num_rows=1000)
