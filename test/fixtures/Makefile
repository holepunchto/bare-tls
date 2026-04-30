all: \
	cert.key \
	cert.crt \
	leaf.key \
	chain.crt \
	leaf.ca.crt

%.key:
	openssl genpkey \
		-algorithm rsa \
		-out $@

cert.crt leaf.ca.crt: %.crt: %.cnf %.key
	openssl req \
		-x509 \
		-noenc \
		-days 365 \
		-config $*.cnf \
		-key $*.key \
		-out $@

leaf.crt: %.crt: %.cnf %.key %.ca.crt %.ca.key
	openssl req \
		-new \
		-noenc \
		-config $*.cnf \
		-key $*.key \
	| openssl x509 \
		-req \
		-days 365 \
		-CA $*.ca.crt \
		-CAkey $*.ca.key \
		-extfile $*.cnf \
		-extensions v3_req \
		-out $@

chain.crt: leaf.crt leaf.ca.crt
	cat $^ > $@
