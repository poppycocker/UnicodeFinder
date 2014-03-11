(function() {

	var mixin = function(dest, src) {
		for (var i in src) {
			if (!src.hasOwnProperty(i)) {
				continue;
			}
			if (dest[i] === undefined) {
				dest[i] = src[i];
			} else {
				throw new Error(dest + ' already has [' + i + '].');
			}
		}
		return dest;
	};

	//                                               (big-endian)
	// [UCS-2 (UCS-4)]     [codepoint bit pattern]   [1st byte]  [2nd byte]  [3rd byte]  [4th byte]
	// U+ 0000..  U+007F    00000000-0xxxxxxx         0xxxxxxx
	// U+ 0080..  U+07FF    00000xxx-xxyyyyyy         110xxxxx    10yyyyyy
	// U+ 0800..  U+FFFF    xxxxyyyy-yyzzzzzz         1110xxxx    10yyyyyy    10zzzzzz    
	// U+10000..U+1FFFFF    00000000-000wwwxx         11110www    10xxxxxx    10yyyyyy    10zzzzzz
	//                     -xxxxyyyy-yyzzzzzz
	var prefixTable = [
		0xc0, // 192(11000000) 2 byte
		0xe0, // 224(11100000) 3 byte
		0xf0 // 240(11110000) 4 byte
	];
	var LIMIT_UCS2 = 0xffff;
	var LIMIT_UCS4 = 0x1fffff;
	var ERR_CODE = -1;

	mixin(String, {
		utf8Octet2Codepoint: function(octet) {
			var bytes, n, shift1st, codePoint;
			octet = +octet;
			// size check: requires less than 4bytes
			bytes = Math.floor(Math.log(octet) / Math.log(0xff) + 1);
			if (bytes > 4) {
				return ERR_CODE;
			}
			// range check
			if ((0x7f < octet && octet < 0xc280) ||
				(0xdfbf < octet && octet < 0xe0a080) ||
				(0xefbfbf < octet && octet < 0xf0908080)) {
				return ERR_CODE;
			}
			// format check: 1st byte
			if (((octet >> ((bytes - 1) * 8)) & ((0xff >> (7 - bytes)) << (7 - bytes))) !== prefixTable[bytes - 2]) {
				return ERR_CODE;
			}
			// format check: 2nd,3rd,4th byte
			for (n = 0; n < bytes - 1; n++) {
				if (((octet >> (n * 8)) & 0xc0) !== 0x80) {
					return ERR_CODE;
				}
			}

			// mask 1st byte
			shift1st = (bytes === 1) ? 0 : (bytes + 1);
			codePoint = (octet >> ((bytes - 1) * 8)) & (0xff >> shift1st);
			for (n = 1; n < bytes; n++) {
				codePoint <<= 6;
				// 2nd-4th byte: mask 0b00111111
				codePoint += (octet >> ((bytes - 1 - n) * 8)) & 0x3f;
			}
			return codePoint;
		},
		codePoint2UTF8Octet: function(codePoint) {
			// 12345(dec) -> 12345(dec)
			// U+12345(Codepoint,hex) -> 74565(dec)
			var octet, bytes = 2,
				signed;
			// convert String to hex num
			if (typeof(codePoint) === 'string') {
				codePoint = +('0x' + codePoint.toLowerCase().replace('u+', ''));
				if (isNaN(codePoint)) {
					return ERR_CODE;
				}
			}
			if (codePoint > LIMIT_UCS4) {
				return ERR_CODE;
			}
			// ASCII
			if (codePoint <= 0x007f) {
				return codePoint;
			}

			octet = ((codePoint & 0x3f) + 0x80);
			if (codePoint > 0x07ff) {
				octet += (((codePoint >> 6) & 0x3f) + 0x80) << 8;
				bytes++;
			}
			if (codePoint > LIMIT_UCS2) {
				octet += (((codePoint >> 12) & 0x3f) + 0x80) << 16;
				bytes++;
			}
			signed = (((codePoint >> ((bytes - 1) * 6)) & (bytes === 4 ? 0x07 : 0x3f)) + (prefixTable[bytes - 2])) << ((bytes - 1) * 8);
			// signed->unsigned hack
			octet += signed >>> 0;

			return octet;
		},
		codePoint2UTF16Octet: function(codePoint) {
			if (codePoint <= LIMIT_UCS2) {
				return [codePoint];
			}
			if (codePoint > LIMIT_UCS4) {
				return [0];
			}
			// surrogate pair
			codePoint -= 0x10000;
			var w1 = 0xd800 | (codePoint >> 10);
			var w2 = 0xdc00 | (codePoint & 0x03ff);
			return [w1, w2];
		},
		fromCharCodeEx: function(codePoint) {
			var w = this.codePoint2UTF16Octet(codePoint);
			return String.fromCharCode.apply(null, w);
		}
	});

	mixin(String.prototype, {
		zeroPadding: function(length) {
			var i = 0,
				zeros = '';
			if (length < this.length || !length) {
				return this;
			}
			if (length === 'even') {
				return ((this.length % 2 === 0) ? '' : '0') + this;
			} else if (length === 'odd') {
				return ((this.length % 2 === 0) ? '0' : '') + this;
			}
			for (; i < length - 1; i++) {
				zeros += '0';
			}
			return (zeros + this).slice(0 - length);
		},
		charCodeAtEx: function(idx) {
			var x = this.charCodeAt(idx);
			var y = idx + 1 < this.length ? this.charCodeAt(idx + 1) : 0;
			if (0xD800 <= x && x <= 0xDBFF && 0xDC00 <= y && y <= 0xDFFF) {
				return 0x10000 + ((x & 0x3FF) << 10) | (y & 0x3FF);
			}
			return x;
		}

	});

	mixin(Array.prototype, {
		uniq: function() {
			// depends on source's order
			var o = {}, i = 0,
				r = [];
			for (; i < this.length; i++) {
				if (o[this[i]] === undefined) {
					r.push(this[i]);
				}
				o[this[i]] = this[i];
			}
			return r;
		}
	});

	mixin(String.prototype, {
		devideBy: function(count, delimiter) {
			count = count || 1;
			delimiter = delimiter || ' ';
			var ret = '',
				i = 0;
			for (; i < this.length; i++) {
				ret += this[i];
				if (((i + 1) % count === 0) && (i !== this.length - 1)) {
					ret += delimiter;
				}
			}
			return ret;
		}
	});

})();