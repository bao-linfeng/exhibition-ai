export function useToast() {
  function toast(options: {
    title: string;
    description?: string;
    variant?: 'default' | 'destructive';
  }) {
    // 简单的 console 实现，实际应该使用 toast 库
    console.log('[Toast]', options);
  }

  return { toast };
}
