/**
 * Formats a number to Indian Rupee representation (e.g. ₹1,25,000.00 or ₹27,000)
 */
export function formatINR(amount: number, showDecimals: boolean = false): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return showDecimals ? '₹0.00' : '₹0';
  }

  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  
  // Format integer and fractional parts
  const rounded = showDecimals ? absAmount.toFixed(2) : Math.round(absAmount).toString();
  const parts = rounded.split('.');
  let intPart = parts[0];
  const decPart = parts.length > 1 ? `.${parts[1]}` : (showDecimals ? '.00' : '');

  // Indian numbering grouping (last 3 digits, then pairs of 2 digits)
  if (intPart.length > 3) {
    const last3 = intPart.substring(intPart.length - 3);
    const rest = intPart.substring(0, intPart.length - 3);
    const restFormatted = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    intPart = `${restFormatted},${last3}`;
  }

  const formatted = `₹${intPart}${decPart}`;
  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Rounds to 2 decimal places safely to prevent floating point inaccuracies
 */
export function roundCurrency(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Converts amount in numbers to words (e.g., "Twenty-Seven Thousand Rupees Only")
 */
export function numberToWordsINR(amount: number): string {
  const num = Math.round(Math.abs(amount));
  if (num === 0) return 'Zero Rupees Only';

  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertLessThanThousand(n: number): string {
    if (n === 0) return '';
    if (n < 20) return units[n];
    const digit = n % 10;
    const ten = Math.floor(n / 10);
    if (n < 100) {
      return tens[ten] + (digit !== 0 ? ` ${units[digit]}` : '');
    }
    const hundred = Math.floor(n / 100);
    const remainder = n % 100;
    return `${units[hundred]} Hundred${remainder !== 0 ? ` and ${convertLessThanThousand(remainder)}` : ''}`;
  }

  let words = '';
  let crore = Math.floor(num / 10000000);
  let remainder = num % 10000000;
  let lakh = Math.floor(remainder / 100000);
  remainder = remainder % 100000;
  let thousand = Math.floor(remainder / 1000);
  remainder = remainder % 1000;
  let hundred = remainder;

  if (crore > 0) {
    words += `${convertLessThanThousand(crore)} Crore `;
  }
  if (lakh > 0) {
    words += `${convertLessThanThousand(lakh)} Lakh `;
  }
  if (thousand > 0) {
    words += `${convertLessThanThousand(thousand)} Thousand `;
  }
  if (hundred > 0) {
    words += `${convertLessThanThousand(hundred)} `;
  }

  return `${words.trim()} Rupees Only`;
}
