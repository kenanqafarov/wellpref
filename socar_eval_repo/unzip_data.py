import os
import zipfile

def unzip_dataset():
    zip_name = "high_freq_data.zip"
    csv_name = "high_freq_data.csv"
    
    if os.path.exists(csv_name):
        print(f"[OK] '{csv_name}' already exists in directory.")
        return

    if not os.path.exists(zip_name):
        print(f"[ERROR] '{zip_name}' not found!")
        return

    print(f"Extracting '{zip_name}'... (This takes a few seconds)")
    with zipfile.ZipFile(zip_name, "r") as z:
        z.extractall(".")
    print(f"[SUCCESS] '{csv_name}' successfully extracted! Size: {os.path.getsize(csv_name)/(1024*1024):.1f} MB")

if __name__ == "__main__":
    unzip_dataset()
