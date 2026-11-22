import os
import cv2
import numpy as np
from PIL import Image

src_img_path = r'C:\Users\User\.gemini\antigravity\brain\4dab1db7-c332-4cb8-9175-5cdedac3dba0\offshore_platform_clean_1795278413594.jpg'
out_dir = r'C:\Users\User\Desktop\socarHACKHATON\wellperf-Platform\client\public'
os.makedirs(out_dir, exist_ok=True)

print(f"Loading source image: {src_img_path}")
base_bgr = cv2.imread(src_img_path)
h_orig, w_orig, _ = base_bgr.shape

# Target resolution for smooth, lightweight 60/20fps background GIF
target_w = 960
target_h = int(h_orig * (target_w / w_orig)) # approx 536
base_bgr = cv2.resize(base_bgr, (target_w, target_h), interpolation=cv2.INTER_LANCZOS4)
H, W, _ = base_bgr.shape
print(f"Resized base image: {W}x{H}")

# Also save high-res and optimized static PNG fallbacks
cv2.imwrite(os.path.join(out_dir, 'caspian-rig.png'), base_bgr)
cv2.imwrite(os.path.join(out_dir, 'caspian-offshore.png'), base_bgr)
print("Saved static PNGs to client/public")

# Key landmarks scaled to target resolution
# Flare is at ~ (x=0.872*W, y=0.233*H)
flare_x = int(0.872 * W)
flare_y = int(0.233 * H)

# Derrick top beacon ~ (x=0.50*W, y=0.12*H)
derrick_x = int(0.50 * W)
derrick_y = int(0.12 * H)

# Water horizon starts around y=0.55*H
horizon_y = int(0.55 * H)

# Precompute coordinate grids for vectorised displacement
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)

# Water depth mask: 0 above horizon, smoothly ramps to 1 at bottom
water_weight = np.clip((yy - horizon_y) / (H - horizon_y), 0.0, 1.0)
water_weight = np.power(water_weight, 1.4) # exponential ramp for realistic perspective

# Flare heat shimmer mask: radial Gaussian around flare
dist_flare = np.sqrt((xx - flare_x)**2 + (yy - flare_y)**2)
flare_mask = np.exp(- (dist_flare**2) / (2 * (0.09 * W)**2)).astype(np.float32)

# Beacon radial mask
dist_beacon = np.sqrt((xx - derrick_x)**2 + (yy - derrick_y)**2)
beacon_mask = np.exp(- (dist_beacon**2) / (2 * (6.0)**2)).astype(np.float32)

num_frames = 24 # 24 frames @ 16-20fps gives 1.2-1.5s seamless loop
frames_rgb = []

print(f"Synthesizing {num_frames} photorealistic animation frames...")

for f in range(num_frames):
    phi = 2.0 * np.pi * (f / num_frames) # seamless phase 0 to 2pi
    
    # 1. Multi-frequency Ocean Wave Displacement Map
    # Wave 1: Long rolling ocean swell traveling right-to-left
    wave1_x = 3.5 * np.sin(xx * 0.035 - phi * 1.0 + yy * 0.015)
    wave1_y = 2.8 * np.cos(yy * 0.045 - phi * 1.0 + xx * 0.010)
    
    # Wave 2: Shorter surface chop traveling diagonally
    wave2_x = 1.8 * np.sin(xx * 0.080 + phi * 2.0 - yy * 0.025)
    wave2_y = 1.5 * np.cos(yy * 0.090 + phi * 2.0 + xx * 0.020)
    
    # Wave 3: High-frequency capillary ripples
    wave3_y = 0.9 * np.sin(xx * 0.160 + yy * 0.120 - phi * 3.0)
    
    disp_x = (wave1_x + wave2_x) * water_weight
    disp_y = (wave1_y + wave2_y + wave3_y) * water_weight
    
    # 2. Flare Heat Shimmer & Turbulent Convection (Rising hot air)
    heat_x = 2.2 * np.sin(yy * 0.12 - phi * 3.0) * flare_mask
    heat_y = 2.5 * np.cos(xx * 0.10 + phi * 2.0) * flare_mask
    
    total_map_x = (xx + disp_x + heat_x).astype(np.float32)
    total_map_y = (yy + disp_y + heat_y).astype(np.float32)
    
    # Remap image pixels with bicubic interpolation
    frame_bgr = cv2.remap(base_bgr, total_map_x, total_map_y, interpolation=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    
    # 3. Flare Flame & Ambient Glow Breathing
    # Natural flame flicker composed of harmonic sines
    flare_flicker = 1.0 + 0.10 * np.sin(phi * 2.0) + 0.05 * np.sin(phi * 5.0)
    if flare_flicker != 1.0:
        # Boost warm channels (Red & Green) around flare
        glow = flare_mask[:, :, np.newaxis] * (flare_flicker - 1.0)
        # Apply warm gold tint to glow
        warm_boost = np.zeros_like(frame_bgr, dtype=np.float32)
        warm_boost[:, :, 2] = frame_bgr[:, :, 2].astype(np.float32) * 1.35 # Red
        warm_boost[:, :, 1] = frame_bgr[:, :, 1].astype(np.float32) * 1.15 # Green
        warm_boost[:, :, 0] = frame_bgr[:, :, 0].astype(np.float32) * 0.90 # Blue
        frame_bgr = np.clip(frame_bgr.astype(np.float32) + (warm_boost - frame_bgr.astype(np.float32)) * glow, 0, 255).astype(np.uint8)

    # 4. Red Aviation Warning Strobe at Derrick Top (Realistic flash pulse)
    strobe_phase = (np.sin(phi * 2.0))**8 # sharp intermittent pulse
    if strobe_phase > 0.1:
        strobe_val = float(strobe_phase * 220)
        strobe_layer = np.zeros_like(frame_bgr, dtype=np.float32)
        strobe_layer[:, :, 2] = strobe_val # Pure bright warning red
        strobe_weight = beacon_mask[:, :, np.newaxis] * 0.85
        frame_bgr = np.clip(frame_bgr.astype(np.float32) + strobe_layer * strobe_weight, 0, 255).astype(np.uint8)

    # 5. Specular Water Caustics / Glistening Highlights
    water_glint = (np.sin(xx * 0.07 + yy * 0.05 + phi * 2.0) * np.cos(xx * 0.04 - phi * 1.0))
    water_glint = np.clip(water_glint, 0.0, 1.0) * water_weight * 14.0
    frame_bgr[:, :, 0] = np.clip(frame_bgr[:, :, 0].astype(np.float32) + water_glint * 1.1, 0, 255).astype(np.uint8)
    frame_bgr[:, :, 1] = np.clip(frame_bgr[:, :, 1].astype(np.float32) + water_glint * 1.0, 0, 255).astype(np.uint8)
    frame_bgr[:, :, 2] = np.clip(frame_bgr[:, :, 2].astype(np.float32) + water_glint * 0.7, 0, 255).astype(np.uint8)

    # Convert to RGB PIL Image
    frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    pil_frame = Image.fromarray(frame_rgb)
    frames_rgb.append(pil_frame)

print(f"All {num_frames} frames rendered. Quantizing & generating optimized looping GIF...")

# High-quality adaptive palette quantization with dithering for photorealism
pil_frames_quant = []
# Create a global shared palette from the first frame for smooth gradients
first_quant = frames_rgb[0].convert('P', palette=Image.ADAPTIVE, colors=256, dither=Image.Dither.FLOYDSTEINBERG)
pil_frames_quant.append(first_quant)

for fr in frames_rgb[1:]:
    q = fr.quantize(palette=first_quant, dither=Image.Dither.FLOYDSTEINBERG)
    pil_frames_quant.append(q)

gif_path1 = os.path.join(out_dir, 'caspian-rig.gif')
gif_path2 = os.path.join(out_dir, 'caspian-offshore.gif')

# Save GIF with loop=0 (infinite loop), duration=65ms (~15-16 fps)
pil_frames_quant[0].save(
    gif_path1,
    save_all=True,
    append_images=pil_frames_quant[1:],
    loop=0,
    duration=65,
    optimize=True
)

import shutil
shutil.copyfile(gif_path1, gif_path2)

size_mb = os.path.getsize(gif_path1) / (1024 * 1024)
print(f"SUCCESS: Saved ultra-realistic GIF to {gif_path1} ({size_mb:.2f} MB)")
