'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UploadedFile {
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  message?: string;
}

export function DocumentUpload() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      status: 'pending' as const,
    }));
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    multiple: true,
  });

  const uploadFiles = async () => {
    setIsUploading(true);
    
    for (let i = 0; i < files.length; i++) {
      if (files[i].status !== 'pending') continue;
      
      setFiles(prev => prev.map((f, idx) => 
        idx === i ? { ...f, status: 'uploading' } : f
      ));

      const formData = new FormData();
      formData.append('file', files[i].file);

      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
        const response = await fetch(`${backendUrl}/upload`, {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          setFiles(prev => prev.map((f, idx) => 
            idx === i ? { ...f, status: 'success', message: data.message } : f
          ));
        } else {
          throw new Error('Upload failed');
        }
      } catch (error) {
        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: 'error', message: 'Upload failed' } : f
        ));
      }
    }
    
    setIsUploading(false);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const pendingFiles = files.filter(f => f.status === 'pending');

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
        )}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        {isDragActive ? (
          <p className="text-lg font-semibold text-blue-600">Drop the files here...</p>
        ) : (
          <div>
            <p className="text-lg font-semibold text-gray-700">
              Drag & drop FDA documents here
            </p>
            <p className="text-sm text-gray-500 mt-2">
              or click to select files (PDF, TXT, DOCX)
            </p>
          </div>
        )}
      </div>

      {files.length > 0 && (
        <div className="mt-6 space-y-2">
          <h3 className="text-lg font-semibold text-gray-700">Files</h3>
          {files.map((uploadedFile, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <File className="h-5 w-5 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">
                  {uploadedFile.file.name}
                </span>
                <span className="text-xs text-gray-500">
                  ({(uploadedFile.file.size / 1024).toFixed(1)} KB)
                </span>
              </div>
              <div className="flex items-center gap-2">
                {uploadedFile.status === 'uploading' && (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                )}
                {uploadedFile.status === 'success' && (
                  <span className="text-xs text-green-600">✓ Uploaded</span>
                )}
                {uploadedFile.status === 'error' && (
                  <span className="text-xs text-red-600">Failed</span>
                )}
                {uploadedFile.status === 'pending' && (
                  <button
                    onClick={() => removeFile(index)}
                    className="p-1 hover:bg-gray-200 rounded"
                  >
                    <X className="h-4 w-4 text-gray-500" />
                  </button>
                )}
              </div>
            </div>
          ))}
          
          {pendingFiles.length > 0 && (
            <button
              onClick={uploadFiles}
              disabled={isUploading}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isUploading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading...
                </span>
              ) : (
                `Upload ${pendingFiles.length} file${pendingFiles.length > 1 ? 's' : ''}`
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}