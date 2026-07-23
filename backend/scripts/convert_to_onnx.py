import os
import torch
import torch.nn as nn
import torchvision.models as models

# ---------------------------------------------------------
# MANUAL STEP: Run this script locally to convert the PyTorch model to ONNX.
# Command: python backend/scripts/convert_to_onnx.py
# Once generated, commit backend/models/chest_xray_model.onnx to git.
# ---------------------------------------------------------

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    weights_path = os.path.join(base_dir, 'shorya_best_xray_model.pth')
    if not os.path.exists(weights_path):
        weights_path = os.path.join(base_dir, 'kaggle_chest_cnn.pt')
        
    if not os.path.exists(weights_path):
        print(f"Error: Neither shorya_best_xray_model.pth nor kaggle_chest_cnn.pt found in {base_dir}")
        return

    print(f"Loading weights from {weights_path}...")
    
    # Initialize the model architecture identically to the server
    model = models.resnet50(weights=None)
    model.fc = nn.Linear(model.fc.in_features, 6)
    
    # Load weights
    loaded = torch.load(weights_path, map_location=torch.device('cpu'))
    if isinstance(loaded, dict):
        if "state_dict" in loaded:
            model.load_state_dict(loaded["state_dict"])
        else:
            model.load_state_dict(loaded)
    else:
        model = loaded
        
    model.eval()
    
    # Create models directory if it doesn't exist
    models_dir = os.path.join(base_dir, 'models')
    os.makedirs(models_dir, exist_ok=True)
    
    onnx_path = os.path.join(models_dir, 'chest_xray_model.onnx')
    
    # Create dummy input that matches what ResNet50 expects (Batch, Channels, Height, Width)
    dummy_input = torch.randn(1, 3, 224, 224)
    
    print(f"Exporting model to {onnx_path}...")
    torch.onnx.export(
        model, 
        dummy_input, 
        onnx_path, 
        export_params=True,
        opset_version=14, # 14 is a stable choice for modern PyTorch versions
        do_constant_folding=True,
        input_names=['input'], 
        output_names=['output'],
        dynamic_axes={'input': {0: 'batch_size'}, 'output': {0: 'batch_size'}}
    )
    
    print(f"✅ Successfully exported ONNX model to {onnx_path}")
    print("Next step: Commit the ONNX file to git so Render can use it.")

if __name__ == "__main__":
    main()
