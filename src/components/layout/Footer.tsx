export function Footer() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-sm border-t border-gray-800 py-3 px-6 z-50">
      <div className="flex justify-between items-center">
        <p className="text-xs text-gray-400">
          © {new Date().getFullYear()} Smart Health Manager. All Rights Reserved.
        </p>
        <p className="text-xs text-gray-500">
          Powered By{' '}
          <a
            href="https://cromstelit.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-gray-300 transition-colors"
          >
            Cromstel IT Group
          </a>
        </p>
      </div>
    </footer>
  );
}
