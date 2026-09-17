/**
 * Converts a numeric amount to words following the Indian currency numbering format.
 * Example: 125450.50 -> "One Lakh Twenty-Five Thousand Four Hundred Fifty Rupees and Fifty Paise Only"
 */

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function convertTwoDigits(num) {
  if (num === 0) return "";
  if (num < 20) return ONES[num];
  const ten = Math.floor(num / 10);
  const one = num % 10;
  return TENS[ten] + (one > 0 ? "-" + ONES[one] : "");
}

function convertThreeDigits(num) {
  if (num === 0) return "";
  const hundred = Math.floor(num / 100);
  const rest = num % 100;
  let str = "";
  if (hundred > 0) {
    str += ONES[hundred] + " Hundred";
  }
  if (rest > 0) {
    str += (str ? " and " : "") + convertTwoDigits(rest);
  }
  return str;
}

export function numberToWordsIndian(amount) {
  const num = Number(amount);
  if (isNaN(num) || num === 0) return "Zero Rupees Only";
  if (num < 0) return "Minus " + numberToWordsIndian(Math.abs(num));

  const parts = num.toFixed(2).split(".");
  let integerPart = parseInt(parts[0], 10);
  const paisaPart = parseInt(parts[1], 10);

  if (integerPart === 0 && paisaPart === 0) return "Zero Rupees Only";

  let words = "";

  // Crores (>= 1,00,00,000)
  if (integerPart >= 10000000) {
    const crore = Math.floor(integerPart / 10000000);
    words += numberToWordsIndian(crore).replace(/ Rupees Only/g, "") + " Crore ";
    integerPart %= 10000000;
  }

  // Lakhs (>= 1,00,000)
  if (integerPart >= 100000) {
    const lakh = Math.floor(integerPart / 100000);
    words += convertTwoDigits(lakh) + " Lakh ";
    integerPart %= 100000;
  }

  // Thousands (>= 1,000)
  if (integerPart >= 1000) {
    const thousand = Math.floor(integerPart / 1000);
    words += convertTwoDigits(thousand) + " Thousand ";
    integerPart %= 1000;
  }

  // Hundreds & Below
  if (integerPart > 0) {
    words += convertThreeDigits(integerPart);
  }

  words = words.trim();
  if (words) {
    words += " Rupees";
  }

  if (paisaPart > 0) {
    const paisaWords = convertTwoDigits(paisaPart);
    if (words) {
      words += " and " + paisaWords + " Paise";
    } else {
      words = paisaWords + " Paise";
    }
  }

  return words ? words + " Only" : "Zero Rupees Only";
}

export default numberToWordsIndian;
