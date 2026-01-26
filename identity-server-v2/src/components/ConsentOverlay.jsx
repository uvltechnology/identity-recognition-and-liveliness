export default function ConsentOverlay({ onAccept, onDecline }) {
  return (
    <div className="consent-overlay">
      <div className="consent-box">
        <h2 className="text-xl font-semibold mb-2">Privacy & Camera Consent</h2>
        <p className="mb-3 text-sm text-gray-700">
          This verification will capture images to extract identity data (name, DOB, ID number).
          By continuing you consent to allow the camera to capture images and to send them to the
          verification service. Do not proceed if you do not consent.
        </p>
        <p className="mb-4 text-sm text-gray-700 font-semibold">Image quality guidance:</p>
        <ul className="list-disc pl-5 mb-4 text-sm text-gray-700">
          <li>Use good, even lighting — avoid strong backlight or heavy shadows.</li>
          <li>Ensure the image is sharp and not blurred.</li>
          <li>Make sure the entire document or face is visible and not cropped.</li>
          <li>The document or photo must belong to you — do not submit someone else's ID or photo.</li>
        </ul>
        <div className="flex gap-2 justify-end mt-3">
          <button
            onClick={onDecline}
            className="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-medium"
          >
            Decline
          </button>
          <button
            onClick={onAccept}
            className="px-4 py-2 rounded-md bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium"
          >
            I Consent & Start Camera
          </button>
        </div>
      </div>
    </div>
  );
}
