export function formatPeso(cents: number): string {
  const value = (cents || 0) / 100;
  return `₱${value.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDateTime(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatPaymentLabel(method: string): string {
  switch (method) {
    case 'cod':
      return 'Cash on Delivery';
    case 'cop':
      return 'Cash on Pickup';
    case 'gcash':
      return 'GCash';
    default:
      return method.toUpperCase();
  }
}

export function getStatusStyle(status: string): string {
  switch (status) {
    case 'Completed':
      return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    case 'Cancelled':
      return 'text-red-700 bg-red-50 border-red-200';
    case 'Pending':
      return 'text-amber-800 bg-amber-50 border-amber-200';
    case 'Confirmed':
    case 'Preparing':
    case 'Ready for Pickup':
    case 'Out for Delivery':
      return 'text-neutral-900 bg-yellow-100 border-yellow-300';
    default:
      return 'text-neutral-700 bg-neutral-100 border-neutral-200';
  }
}
