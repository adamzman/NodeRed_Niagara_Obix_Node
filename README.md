# Function: 
**Links to a Niagara Station through the Obix Protocol...**

---
# Setup: 
To set up Obix in Niagara, drag in the Obix Network (from the palette) into the drivers folder. Then drag in the HTTP BasicScheme from the baja palette (baja -> AuthenticationSchemes -> WebServicesSchemes -> HTTPBasic) into the Authentication Service in the Services folder (Services -> AuthenticationService -> Authentication Schemes). Next, create a new user with an admin role and select the HTTPBasicScheme for the Authentication Scheme Name. OBIX uses HTTP only, so HTTP must be enabled and opened in the firewall.

---
More Details about each Node is in the nodes folder README