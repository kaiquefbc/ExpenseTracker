from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import json
import os

app = Flask(__name__)
CORS(app)

DATA_FILE = 'data.json'

# Load transactions from file or start empty
def load_transactions():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r') as f:
            return json.load(f)
    return []

# Save transactions to file
def save_transactions(data):
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f, indent=2)

# Initialize
transactions = load_transactions()
next_id = max((t["id"] for t in transactions), default=0) + 1

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/transactions', methods=['GET', 'POST'])
def transactions_route():
    global next_id, transactions
    if request.method == 'POST':
        data = request.get_json()
        transaction = {
            "id": next_id,
            "text": data["text"],
            "amount": float(data["amount"]),
            "month": data["month"],
            "type": data["type"]
        }
        transactions.append(transaction)
        next_id += 1
        save_transactions(transactions)
        return jsonify(transaction), 201
    else:
        return jsonify(transactions)

@app.route('/delete/<int:tx_id>', methods=['DELETE'])
def delete_transaction(tx_id):
    global transactions
    before = len(transactions)
    transactions = [tx for tx in transactions if tx["id"] != tx_id]
    after = len(transactions)

    if before != after:
        save_transactions(transactions)
        return jsonify({"result": "success", "deleted": tx_id}), 200
    else:
        return jsonify({"result": "not found"}), 404

if __name__ == '__main__':
    app.run(debug=True)