# Dynamic State & Load GPU Textures

## 背景
目前發現 `globals.model` 並不會儲存任何 GPU 資訊，例如模擬出的點位、速度等等。  
因此，直接在 GPU 端儲存資料可能是一個更有效的方法。  

目前想法：  
- 透過在 GPU 端複製紋理（texture）來保存狀態，避免 CPU ↔ GPU 的資料傳輸開銷。  
- 具體實作需要查閱 WebGL 方法或請教 AI 協助。

---

## 任務描述 (Task Description)
目標：實作一個機制，可以在不經過 CPU 的情況下儲存與讀取 GPU 紋理。  

**需求：**
1. 只考慮 **單一保存狀態**。
2. 當按下 **儲存（save）** 或 **Ctrl+C** 時，將目前 GPU 狀態保存以便後續使用。
3. 當按下 **載入（load）** 或 **Ctrl+V** 時，丟棄當前 GPU 狀態，並將其替換為之前保存的狀態（如果存在）。

**提示：**
- 可以使用 Ctrl+C/V 或按鈕操作，選擇簡單的方式即可。
- 雖然可以透過 CPU 端參數（例如「角度變化」或「消失剛性」）重新初始化 GPU 來重建模擬狀態，但這會造成額外開銷，尤其是在進行深度搜索或頻繁回滾時。  
- 更有效率的做法是 **直接在 GPU 端複製紋理**，保持 snapshot 完全在 GPU 記憶體中。

---

## 初步實作構想
建議在 `GPUMath.js` 中實作幾個方法：

```javascript
// 複製紋理的輔助函式
function copyTexture(srcTex, dstTex) {
    // 具體實作需要使用 WebGL 方法
}

// 創建額外的紋理用於保存狀態
let savedTex = initTexture();

function saveTexture() {
    copyTexture(currentTex, savedTex);
}

function loadTexture() {
    if (!savedTex) return;
    copyTexture(savedTex, currentTex);
}
```
重點：
- 保存狀態完全在 GPU 端完成。
- 避免頻繁 CPU ↔ GPU 的資料傳輸，提高模擬性能。
- 可以快速回滾或切換狀態，方便探索不同模擬路徑。
