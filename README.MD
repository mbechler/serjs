# A Java serializer in JavaScript

Implementation of native Java serialization in JavaScript.
Also includes two deserialization payload generators
(as seen on [ysoserial](https://github.com/frohoff/ysoserial): 
JRMPClient and a JNDI variant of CommonBeanutils1)
as well as a PoC for CVE-2018-2800:

Up to the April 2018 CPU (6u191, 7u181, 8u171) Java's RMI endpoints
allowed HTTP tunneling of requests. Failing to implement further
restrictions on these requests it was possible to perform them
as cross-origin requests from third-party websites.
This makes it possible to exploit otherwise unreachable RMI endpoints.

[Blog post with some more info](https://mbechler.github.io/2018/05/21/Java-CVE-2018-2800/)

## Disclaimer

All information and code is provided solely for educational purposes 
and/or testing your own systems for these vulnerabilities.


## Notes

Some browsers/browser plugins may implement further restrictions
trying to disallow requests to local networks.

The JMX/RMI PoC vectors have already been addressed in an earlier Java release.
