from flask import Flask, request, send_from_directory, jsonify
import os, json
from werkzeug.utils import secure_filename

app = Flask(__name__, static_url_path='', static_folder='.')

UPLOAD_FOLDER = 'images/streetview'
PINS_FILE = 'data/pins.json'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(os.path.dirname(PINS_FILE), exist_ok=True)
if not os.path.exists(PINS_FILE):
    with open(PINS_FILE,'w') as f: f.write('[]')

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def static_proxy(path):
    return send_from_directory('.', path)

@app.route('/save_pin', methods=['POST'])
def save_pin():
    name = request.form.get('name')
    lat = request.form.get('lat')
    lng = request.form.get('lng')
    file = request.files.get('image')
    if not (name and lat and lng and file):
        return jsonify({'status':'error','msg':'missing'}), 400

    filename = secure_filename(file.filename)
    if not filename.lower().endswith(('.jpg','.jpeg','.png')):
        filename += '.jpg'
    save_path = os.path.join(UPLOAD_FOLDER, filename)
    file.save(save_path)

@app.route('/save_path', methods=['POST'])
def save_path():
    # Accepts JSON with {"paths": [ ... ]}
    try:
        data = request.get_json()
        if not data or 'paths' not in data:
            return jsonify({'status':'error','msg':'invalid'}), 400
        incoming = data['paths']
        # load existing
        with open(PINS_FILE.replace('pins.json','paths.json'), 'r', encoding='utf-8') as f:
            try:
                existing = json.load(f)
            except:
                existing = []
        # append incoming (or replace logic can be implemented)
        existing.extend(incoming)
        with open('data/paths.json', 'w', encoding='utf-8') as f:
            json.dump(existing, f, indent=2, ensure_ascii=False)
        return jsonify({'status':'success'})
    except Exception as e:
        print('save_path error', e)
        return jsonify({'status':'error','msg':str(e)}), 500

    with open(PINS_FILE,'r') as f:
        pins = json.load(f)
    pins.append({
        'name': name,
        'lat': float(lat),
        'lng': float(lng),
        'image': filename,
        # empty connections by default
        'connections': {}
    })
    with open(PINS_FILE,'w') as f:
        json.dump(pins, f, indent=2, ensure_ascii=False)

    return jsonify({'status':'success'})

if __name__ == '__main__':
    app.run(debug=True)
