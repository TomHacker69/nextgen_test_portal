import os
import sys
import subprocess
import time

MONGOD_EXE = r"C:\Users\admin\scoop\apps\mongodb\8.3.11\bin\mongod.exe"
REDIS_EXE = r"C:\Users\admin\scoop\apps\redis\8.10.1\redis-server.exe"
DB_PATH = r"C:\data\db"

def start_services():
    print("Preparing DB directory...", flush=True)
    os.makedirs(DB_PATH, exist_ok=True)
    lock_file = os.path.join(DB_PATH, "mongod.lock")
    if os.path.exists(lock_file):
        try:
            os.remove(lock_file)
            print("Cleaned up mongod.lock", flush=True)
        except Exception:
            pass

    print("Launching MongoDB...", flush=True)
    subprocess.Popen(
        [MONGOD_EXE, "--dbpath", DB_PATH, "--port", "27017"],
        creationflags=0x00000008, # DETACHED_PROCESS
        close_fds=True
    )

    print("Launching Redis...", flush=True)
    subprocess.Popen(
        [REDIS_EXE],
        creationflags=0x00000008, # DETACHED_PROCESS
        close_fds=True
    )

    time.sleep(3)

    import pymongo, redis
    try:
        mc = pymongo.MongoClient("mongodb://localhost:27017", serverSelectionTimeoutMS=3000, connectTimeoutMS=3000)
        mc.admin.command("ping")
        print("✅ MongoDB is UP and responding on port 27017", flush=True)
    except Exception as e:
        print(f"MongoDB ping warning: {e}", flush=True)

    try:
        rc = redis.Redis(host="localhost", port=6379, socket_timeout=2)
        rc.ping()
        print("✅ Redis is UP and responding on port 6379", flush=True)
    except Exception as e:
        print(f"Redis ping warning: {e}", flush=True)

if __name__ == "__main__":
    start_services()
