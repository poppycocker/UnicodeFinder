(function() {

	var mixin = function(dest, src) {
		for (var i in src) {
			if (!src.hasOwnProperty(i)) {
				continue;
			}
			if (!dest[i]) {
				dest[i] = src[i];
			} else {
				throw new Error(dest + ' already has [' + i + '].');
			}
		}
		return dest;
	};

	// [UCS-2 (UCS-4)]     [codepoint bit pattern]   [1st byte]  [2nd byte]  [3rd byte]  [4th byte]
	// U+ 0000..  U+007F    00000000-0xxxxxxx         0xxxxxxx
	// U+ 0080..  U+07FF    00000xxx-xxyyyyyy         110xxxxx    10yyyyyy
	// U+ 0800..  U+FFFF    xxxxyyyy-yyzzzzzz         1110xxxx    10yyyyyy    10zzzzzz    
	// U+10000..U+1FFFFF    00000000-000wwwxx         11110www    10xxxxxx    10yyyyyy    10zzzzzz
	//                     -xxxxyyyy-yyzzzzzz
	var headerTable = [
		0xc0, // 192(11000000) 2 byte
		0xe0, // 224(11100000) 3 byte
		0xf0  // 240(11110000) 4 byte
	];
	var LIMIT_UCS2 = 0xffff;
	var LIMIT_UCS4 = 0x1fffff;

	mixin(String, {
		octet2Codepoint: function(octet) {
			var bytes, n, shift1st, codePoint;
			octet = +octet;
			// range check
			if ((0x7f < octet && octet < 0xc280) ||
				(0xdfbf < octet && octet < 0xe0a080) ||
				(0xefbfbf < octet && octet < 0xf0908080)) {
				return 0;
			}
			// requires less than 4bytes
			bytes = Math.floor(Math.log(octet) / Math.log(0xFF) + 1);
			if (bytes > 4) {
				return 0;
			}
			// mask 1st byte
			shift1st = (bytes === 1) ? 0 : (bytes + 1);
			codePoint = (octet >> ((bytes - 1) * 8)) & (0xFF >> shift1st);
			for (n = 1; n < bytes; n++) {
				codePoint <<= 6;
				// 2nd-4th byte: mask 0x00111111
				codePoint += (octet >> ((bytes - 1 - n) * 8)) & 0x3F;
			}
			return codePoint;
		},
		codepoint2Octet: function(codePoint) {
			var octet, bytes = 2,
				signed;
			// 12345(dec) -> 12345(dec)
			// U+12345(octet) -> 74565(dec)
			if (typeof(codePoint) === 'string') {
				codePoint = +('0x' + codePoint.toLowerCase().replace('u+', ''));
			}
			if (codePoint > LIMIT_UCS4) {
				return 0;
			}
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
			signed = (((codePoint >> ((bytes - 1) * 6)) & (bytes === 4 ? 0x07 : 0x3f)) + (headerTable[bytes - 2])) << ((bytes - 1) * 8);
			// signed->unsigned hack
			octet += signed >>> 0;

			return octet;
		},
		fromCharCodeEx: function(codePoint) {
			if (codePoint <= LIMIT_UCS2) {
				return String.fromCharCode(codePoint);
			}
			if (codePoint > LIMIT_UCS4) {
				return '';
			}
			codePoint -= 0x10000;
			var w1 = 0xd800 | (codePoint >> 10);
			var w2 = 0xDC00 | (codePoint & 0x03FF);
			return String.fromCharCode(w1, w2);
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
				return (this.length % 2 === 0) ? '' + this : '0' + this;
			} else if (length === 'odd') {
				return (this.length % 2 === 0) ? '0' + this : '' + this;
			} else {
				for (; i < length - 1; i++) {
					zeros += '0';
				}
				return (zeros + this).slice(0 - length);
			}
		}
	});

	mixin(Array.prototype, {
		uniq: function() {
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

})();