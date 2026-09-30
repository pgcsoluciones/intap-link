const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify'])
const jwk=await crypto.subtle.exportKey('jwk',pair.privateKey)
process.stdout.write(JSON.stringify(jwk))
