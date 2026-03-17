interface StatusNotificationProps {
  message: string;
}

export function StatusNotification({ message }: StatusNotificationProps) {
  const isError = message.includes('Error') || message.includes('error');
  const isSuccess = message.includes('successfully') || message.includes('Logged in');
  const isLoading = !isError && !isSuccess;

  return (
    <div className="fixed bottom-4 right-4 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4 max-w-md shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-start gap-3">
        {isLoading && (
          <div className="mt-0.5">
            <svg className="animate-spin h-4 w-4 text-[#1f6feb]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        )}
        <p className={`text-sm flex-1 ${
          isError ? 'text-red-400' : isSuccess ? 'text-green-400' : 'text-gray-300'
        }`}>
          {message}
        </p>
      </div>
    </div>
  );
}
