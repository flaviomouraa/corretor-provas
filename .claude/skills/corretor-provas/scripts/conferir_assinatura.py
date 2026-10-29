# Mostra o SHA-256 do certificado que assinou o APK (bloco de assinatura v2/v3).
# Uso: python3 conferir_assinatura.py corretor-de-provas.apk
# A chave permanente do Corretor de Provas é 12:EA:E7:AC:E5:CF:96:AC:F0:FB:06:00:30:0A:AE:DC:4C:03:1B:06:13:C6:11:1B:6E:63:3C:C5:B0:74:E4:75
import struct, sys, hashlib
d = open(sys.argv[1], 'rb').read()
eocd = d.rfind(b'PK\x05\x06'); cd = struct.unpack('<I', d[eocd+16:eocd+20])[0]
assert d[cd-16:cd] == b'APK Sig Block 42', 'sem bloco de assinatura v2'
size = struct.unpack('<Q', d[cd-24:cd-16])[0]; blk = d[cd-size-8+8:cd-24]
i = 0; certs = []
def lp(b, o): n = struct.unpack('<I', b[o:o+4])[0]; return b[o+4:o+4+n], o+4+n
while i < len(blk):
    n, k = struct.unpack('<QI', blk[i:i+12]); val = blk[i+12:i+8+n]; i += 8 + n
    if k in (0x7109871a, 0xf05368c0):  # v2, v3
        signers, _ = lp(val, 0); signer, _ = lp(signers, 0); sd, _ = lp(signer, 0)
        _, o = lp(sd, 0); cl, _ = lp(sd, o); c, _ = lp(cl, 0)
        certs.append((hex(k), hashlib.sha256(c).hexdigest().upper()))
for k, h in certs: print(k, ':'.join(h[j:j+2] for j in range(0, 64, 2)))
