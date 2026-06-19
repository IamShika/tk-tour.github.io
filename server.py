from flask import Flask, request, send_from_directory, jsonify
import os, json
from werkzeug.utils import secure_filename

app = Flask(__name__, static_url_path='', static_folder='.')

UPLOAD_FOLDER = 'images/streetview'
PINS_FILE = 'data/pins.json'
NAVGRAPH_FILE = 'data/navgraph.json'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(os.path.dirname(PINS_FILE), exist_ok=True)
if not os.path.exists(PINS_FILE):
    with open(PINS_FILE,'w') as f: f.write('[]')
if not os.path.exists(NAVGRAPH_FILE):
    with open(NAVGRAPH_FILE,'w') as f: f.write('{"version":"1.0","nodes":{},"edges":[],"transitions":[]}')

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
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)

    with open(PINS_FILE,'r') as f:
        pins = json.load(f)
    pins.append({
        'name': name,
        'lat': float(lat),
        'lng': float(lng),
        'image': filename,
        'connections': {}
    })
    with open(PINS_FILE,'w') as f:
        json.dump(pins, f, indent=2, ensure_ascii=False)

    return jsonify({'status':'success'})

@app.route('/save_path', methods=['POST'])
def save_path_route():
    # Accepts JSON with {"paths": [ ... ]}
    try:
        data = request.get_json()
        if not data or 'paths' not in data:
            return jsonify({'status':'error','msg':'invalid'}), 400
        incoming = data['paths']
        paths_file = PINS_FILE.replace('pins.json','paths.json')
        # load existing
        try:
            with open(paths_file, 'r', encoding='utf-8') as f:
                existing = json.load(f)
        except:
            existing = []
        # append incoming
        existing.extend(incoming)
        with open(paths_file, 'w', encoding='utf-8') as f:
            json.dump(existing, f, indent=2, ensure_ascii=False)
        return jsonify({'status':'success'})
    except Exception as e:
        print('save_path error', e)
        return jsonify({'status':'error','msg':str(e)}), 500

@app.route('/get_navgraph', methods=['GET'])
def get_navgraph():
    try:
        with open(NAVGRAPH_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return jsonify(data)
    except Exception as e:
        print('get_navgraph error', e)
        return jsonify({'version':'1.0','nodes':{},'edges':[],'transitions':[]})

@app.route('/save_navgraph', methods=['POST'])
def save_navgraph():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'status':'error','msg':'no data'}), 400

        # Validate structure
        if 'nodes' not in data or 'edges' not in data:
            return jsonify({'status':'error','msg':'invalid structure'}), 400

        # Ensure version
        if 'version' not in data:
            data['version'] = '1.0'
        if 'transitions' not in data:
            data['transitions'] = []

        with open(NAVGRAPH_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        return jsonify({'status':'success'})
    except Exception as e:
        print('save_navgraph error', e)
        return jsonify({'status':'error','msg':str(e)}), 500

@app.route('/save_geojson', methods=['POST'])
def save_geojson():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'status':'error','msg':'no data'}), 400
        geojson_file = 'data/buildings.geojson'
        with open(geojson_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return jsonify({'status':'success'})
    except Exception as e:
        print('save_geojson error', e)
        return jsonify({'status':'error','msg':str(e)}), 500

@app.route('/save_building', methods=['POST'])
def save_building():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'status':'error','msg':'no data'}), 400
        buildings_file = 'data/buildings.json'
        try:
            with open(buildings_file, 'r', encoding='utf-8') as f:
                existing = json.load(f)
        except:
            existing = []
        existing.append(data)
        with open(buildings_file, 'w', encoding='utf-8') as f:
            json.dump(existing, f, indent=2, ensure_ascii=False)
        return jsonify({'status':'success'})
    except Exception as e:
        print('save_building error', e)
        return jsonify({'status':'error','msg':str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
