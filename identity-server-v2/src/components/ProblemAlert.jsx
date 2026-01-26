export default function ProblemAlert({ message, level = 'warn', onClose }) {
  const isError = level === 'error';

  return (
    <div className="problem-alert">
      <div className={`problem-alert-box ${isError ? 'error' : 'warn'}`}>
        <div className="flex justify-between items-start">
          <strong className="block mb-1">{isError ? 'Error' : 'Notice'}</strong>
          <button
            onClick={onClose}
            className="text-current opacity-60 hover:opacity-100"
          >
            ×
          </button>
        </div>
        <div className="text-sm leading-snug">{message}</div>
      </div>
    </div>
  );
}
