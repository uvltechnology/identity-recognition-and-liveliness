# Identity Recognition & OCR Demo

A complete Node.js/Express application with Google Vision API for Optical Character Recognition (OCR) of identity documents. Features a web interface with real-time camera preview, visual alignment guides, and live feedback for optimal document capture.

## Features

### Backend (Server-side)
- **Google Vision API Integration**: Production-ready OCR using Google Cloud Vision
- **Multiple OCR Endpoints**: Basic text, structured document, and identity document processing
- **File Upload Support**: Handle both direct uploads and base64 image data
- **Express.js Server**: RESTful API with proper error handling and validation
- **CORS Support**: Cross-origin resource sharing for frontend integration

### Frontend (Web Demo)
- **Real-time Camera Access**: Live video preview with device switching
- **Visual Alignment Guide**: Rectangle overlay with corner indicators
- **Live Feedback System**: Real-time brightness, focus, and position analysis
- **Multiple OCR Types**: Choose between basic text, document structure, or identity analysis
- **Responsive Design**: Works on desktop and mobile devices
- **File Upload Alternative**: Process images without camera access

### Visual Guides & Overlays
- **Rectangle Guide**: Visual positioning aid for document alignment
- **Live Alignment Feedback**: Real-time indicators for:
  - Brightness levels (too dark/bright warnings)
  - Focus quality (blur detection)
  - Document positioning (centering guidance)
- **Color-coded Indicators**: Green for good, orange for warnings, red for errors
- **Animated Feedback**: Pulsing effects and smooth transitions

## Quick Start

### Prerequisites
- Node.js 16+ and npm
- Google Cloud Platform account
- Google Vision API enabled

### 1. Google Cloud Setup

1. Create a Google Cloud Project at [console.cloud.google.com](https://console.cloud.google.com)
2. Enable the Vision API:
   ```bash
   gcloud services enable vision.googleapis.com
   ```
3. Create a service account:
   ```bash
   gcloud iam service-accounts create vision-ocr-service
   ```
4. Download the service account key:
   ```bash
   gcloud iam service-accounts keys create key.json \
     --iam-account=vision-ocr-service@YOUR_PROJECT_ID.iam.gserviceaccount.com
   ```
5. Grant Vision API permissions:
   ```bash
   gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
     --member="serviceAccount:vision-ocr-service@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/ml.developer"
   ```

### 2. Installation

1. Clone and navigate to the project:
   ```bash
   cd server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment:
   ```bash
   cp .env.example .env
   ```

4. Edit `.env` file:
   ```env
   PORT=3000
   GOOGLE_APPLICATION_CREDENTIALS=path/to/your/key.json
   ```

5. Start the server:
   ```bash
   npm run dev
   ```

6. Open your browser to `http://localhost:3000`

## API Endpoints

### OCR Processing

#### POST /api/ocr/text
Basic text extraction from images.
- **Body**: `multipart/form-data` with `image` field
- **Response**: Extracted text and word boundaries

#### POST /api/ocr/document  
Structured document analysis with layout detection.
- **Body**: `multipart/form-data` with `image` field
- **Response**: Hierarchical text structure (pages, blocks, paragraphs, words)

#### POST /api/ocr/identity
Comprehensive identity document processing.
- **Body**: `multipart/form-data` with `image` field  
- **Response**: Combined basic and structured text analysis

#### POST /api/ocr/base64
Process base64-encoded images.
- **Body**: JSON with `image` (base64 string) and `type` (text|document|identity)
- **Response**: OCR results based on specified type

### Health Check

#### GET /health
Server health status.
- **Response**: `{"ok": true}`

## Usage Examples

### Camera Capture
1. Click "Start Camera" to begin video preview
2. Position your identity document within the rectangle guide
3. Wait for green alignment indicators (brightness, focus, position)
4. Click "Capture Document" or press Space bar
5. View OCR results in real-time

### File Upload
1. Click "Choose File" to select an image
2. Select OCR type (Basic Text, Document, or Identity)
3. Click "Process Image"
4. View extracted text and analysis

### Keyboard Shortcuts
- **Space Bar**: Capture image (when camera active)
- **Escape**: Stop camera
- Click extracted text to copy to clipboard

## Project Structure

```
server/
├── src/
│   ├── app.js              # Express application setup
│   ├── server.js           # Server entry point
│   └── services/
│       └── ocrService.js   # Google Vision API integration
├── public/                 # Frontend web demo
│   ├── index.html         # Main HTML page
│   ├── css/
│   │   └── style.css      # Styling and visual guides
│   └── js/
│       ├── camera.js      # Camera management
│       ├── alignment.js   # Real-time alignment checking
│       ├── ocr.js         # OCR processing and API calls
│       └── main.js        # Application coordinator
├── package.json
├── .env.example
└── nodemon.json
```

## Configuration Options

### Environment Variables

- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development/production)
- `GOOGLE_APPLICATION_CREDENTIALS`: Path to service account key
- `GOOGLE_CLOUD_PROJECT`: Google Cloud project ID (optional)

### Alignment Thresholds

Customize detection sensitivity in `alignment.js`:

```javascript
this.thresholds = {
    brightness: { min: 50, max: 200, optimal: { min: 80, max: 180 } },
    focus: { minVariance: 100, optimalVariance: 300 },
    position: { centerTolerance: 0.15, sizeTolerance: 0.2 }
};
```

## Browser Compatibility

### Camera Features
- Chrome 53+
- Firefox 36+
- Safari 11+
- Edge 12+

### OCR Features  
- All modern browsers with fetch API support
- IE 11+ with polyfills

## Security Considerations

### Production Deployment
1. Use HTTPS for camera access
2. Implement rate limiting
3. Validate file types and sizes
4. Use environment-specific CORS origins
5. Monitor Google Cloud API usage and costs

### Privacy
- Images are processed server-side and not stored
- Consider implementing client-side OCR for sensitive documents
- Add data retention policies as needed

## Troubleshooting

### Camera Issues
- **Permission Denied**: Allow camera access in browser settings
- **Camera Not Found**: Ensure device has a camera
- **Camera In Use**: Close other applications using the camera

### OCR Issues
- **Authentication Error**: Verify Google Cloud credentials
- **API Quota Exceeded**: Check Google Cloud billing and quotas
- **Poor Results**: Ensure good lighting and document alignment

### Performance Tips
- Use rear camera for document scanning when available
- Ensure adequate lighting for best OCR results
- Keep documents flat and within the alignment guide
- Use structured document OCR for complex layouts

## Development

### Running in Development
```bash
npm run dev
```

### Production Build
```bash
npm start
```

### Testing OCR Endpoints
```bash
# Test with curl
curl -X POST -F "image=@test-document.jpg" \
  http://localhost:3000/api/ocr/identity
```

## License

This project is licensed under the ISC License.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review Google Cloud Vision API documentation
3. Open an issue on the repository
