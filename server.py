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

@app.route('/get_pins', methods=['GET'])
def get_pins():
    try:
        with open(PINS_FILE, 'r', encoding='utf-8') as f:
            pins = json.load(f)
        resp = jsonify(pins)
        resp.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        resp.headers['Pragma'] = 'no-cache'
        return resp
    except Exception as e:
        print('get_pins error', e)
        return jsonify([])

@app.route('/save_pin', methods=['POST'])
def save_pin():
    name = request.form.get('name')
    lat = request.form.get('lat')
    lng = request.form.get('lng')
    floor = request.form.get('floor', 0)
    pin_id = request.form.get('id', f'pin_{int(__import__("time").time() * 1000)}')
    file = request.files.get('image')
    if not (name and lat and lng and file):
        return jsonify({'status':'error','msg':'missing fields'}), 400

    filename = secure_filename(file.filename)
    if not filename.lower().endswith(('.jpg','.jpeg','.png')):
        filename += '.jpg'
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)

    # Auto-compress uploaded image for fast loading on GitHub Pages
    try:
        from PIL import Image as PILImage
        img = PILImage.open(filepath)
        if img.mode in ('RGBA', 'P', 'LA'):
            img = img.convert('RGB')
        w, h = img.size
        max_w, max_h = 4096, 2048
        if w > max_w or h > max_h:
            ratio = min(max_w / w, max_h / h)
            img = img.resize((int(w * ratio), int(h * ratio)), PILImage.LANCZOS)
        img.save(filepath, 'JPEG', quality=85, optimize=True, progressive=True)
        img.close()
        print(f'Compressed uploaded image: {filename}')
    except ImportError:
        print('Pillow not installed, skipping image compression')
    except Exception as e:
        print(f'Image compression warning: {e}')

    with open(PINS_FILE,'r') as f:
        pins = json.load(f)
    pins.append({
        'id': pin_id,
        'name': name,
        'lat': float(lat),
        'lng': float(lng),
        'floor': int(floor),
        'image': filename,
        'connections': {}
    })
    with open(PINS_FILE,'w') as f:
        json.dump(pins, f, indent=2, ensure_ascii=False)

    return jsonify({'status':'success','id': pin_id, 'image': filename})

@app.route('/delete_pin', methods=['POST'])
def delete_pin():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'status':'error','msg':'no data'}), 400
        pin_id = data.get('id', '')
        pin_name = data.get('name', '')
        pin_lat = data.get('lat')
        pin_lng = data.get('lng')

        with open(PINS_FILE, 'r', encoding='utf-8') as f:
            pins = json.load(f)

        original_count = len(pins)
        pins = [p for p in pins if not (
            (pin_id and p.get('id') == pin_id) or
            (pin_name and pin_lat is not None and pin_lng is not None and
             p.get('name') == pin_name and
             abs(p.get('lat', 0) - float(pin_lat)) < 0.00001 and
             abs(p.get('lng', 0) - float(pin_lng)) < 0.00001)
        )]

        with open(PINS_FILE, 'w', encoding='utf-8') as f:
            json.dump(pins, f, indent=2, ensure_ascii=False)

        return jsonify({'status':'success','deleted': original_count - len(pins)})
    except Exception as e:
        print('delete_pin error', e)
        return jsonify({'status':'error','msg':str(e)}), 500

@app.route('/update_pin', methods=['POST'])
def update_pin():
    try:
        data = request.get_json()
        if not data or 'id' not in data:
            return jsonify({'status':'error','msg':'no id provided'}), 400
        
        with open(PINS_FILE, 'r', encoding='utf-8') as f:
            pins = json.load(f)
            
        for p in pins:
            if p['id'] == data['id']:
                if 'yawOffset' in data:
                    p['yawOffset'] = data['yawOffset']
                if 'name' in data:
                    p['name'] = data['name']
                if 'lat' in data:
                    p['lat'] = float(data['lat'])
                if 'lng' in data:
                    p['lng'] = float(data['lng'])
                break
                
        with open(PINS_FILE, 'w', encoding='utf-8') as f:
            json.dump(pins, f, indent=2, ensure_ascii=False)
            
        return jsonify({'status':'success'})
    except Exception as e:
        print('update_pin error', e)
        return jsonify({'status':'error','msg':str(e)}), 500

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
