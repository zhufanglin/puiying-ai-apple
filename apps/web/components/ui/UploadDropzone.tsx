"use client";

import { useCallback, useState } from "react";
import { Upload, File, X, CheckCircle } from "lucide-react";

interface UploadDropzoneProps {
  accept?: string;
  maxSizeMB?: number;
  onUpload: (file: File) => void;
  uploading?: boolean;
  label?: string;
}

export default function UploadDropzone({
  accept = "image/*,.pdf",
  maxSizeMB = 10,
  onUpload,
  uploading,
  label = "拖拽文件到此處，或點擊上傳",
}: UploadDropzoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        if (file.size > maxSizeMB * 1024 * 1024) {
          alert(`文件大小超過 ${maxSizeMB}MB 限制`);
          return;
        }
        setSelectedFile(file);
      }
    },
    [maxSizeMB]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
          dragOver ? "border-primary-400 bg-primary-50" : "border-gray-200 hover:border-gray-300"
        }`}
      >
        <input
          type="file"
          accept={accept}
          onChange={handleFileChange}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
        <Upload size={32} className="mx-auto text-gray-300 mb-2" />
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-xs text-gray-400 mt-1">
          支持 {accept}，最大 {maxSizeMB}MB
        </p>
      </div>

      {/* 已選文件 */}
      {selectedFile && (
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <File size={16} className="text-gray-400" />
          <span className="text-sm text-gray-700 flex-1 truncate">{selectedFile.name}</span>
          <span className="text-xs text-gray-400">
            {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
          </span>
          <button onClick={() => setSelectedFile(null)} className="text-gray-400 hover:text-red-500">
            <X size={16} />
          </button>
          <button
            onClick={() => onUpload(selectedFile)}
            disabled={uploading}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-white bg-primary-500 rounded-lg hover:bg-primary-600 disabled:opacity-50"
          >
            {uploading ? "上傳中..." : (
              <>
                <CheckCircle size={14} /> 確認上傳
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
