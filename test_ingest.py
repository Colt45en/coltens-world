import requests


def main() -> None:
    data = {"topic": "test.topic", "data": {"message": "hello world"}}
    resp = requests.post("http://localhost:3000/ingest", json=data, timeout=5)
    print("Status:", resp.status_code)
    print("Response:", resp.text)


if __name__ == "__main__":
    main()
