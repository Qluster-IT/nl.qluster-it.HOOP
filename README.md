Bringing you H.O.O.P (Dutch for Hope).

Homey Object Oriented Programming (for advanced users).


!Requires the HomeyScript App to be installed!


This apps transforms your Homey in a programmable object, changing standard flow behavior.
Took a look at the Community Forum Topic for diagrams, examples and overal usages.
If you dont understand this app, please don't use it.

Create one (or more) Method Group device(s) and use it like in an Object Oriented Programming manner.
Give it (overloadable) methods which will handle there own objects (devices, flows, variables, etc), removing the need for repetative flows.
Setting the Method Group Device Setting "Overloadable" will let you even trigger a TriggerCard (Text3:, Boolean1:) by an ActionCard (Text:2, Boolean1) or an ActionCard (Text:1)
It will also create long lists, so use it at your own choise.
Make sure when using overloadable, that you check the flowtoken "variable# has value, because non-given arguments will be filled with defaults:
* Text: null or a whitespace ( )
* Number: -1
* Boolean: false
 
ID's must be unique, but surve no further purpose, so use it write comments!
Dont forget to change the ID after duplicating a flow, else, when you trigger one flow, both will be executed.
Just select the first (numeric) option or write one yourself!

Or trigger any flow as condition and await till its done, creating synchronised actions, handling variables before executing any further actions, all within the same flow.

Or create a Card Overloader and allows the execution of Actioncards (Then-Cards) as Conditions and await them.
