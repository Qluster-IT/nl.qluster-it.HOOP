Bringing you H.O.O.P (Dutch for Hope).

Homey Object Oriented Programming (for advanced users).


This apps transforms your Homey in a programmable object, changing standard flow behavior.
Took a look at the Community Forum Topic for diagrams, examples and overal usages.
If you dont understand this app, please don't use it.

You need to grant the app developer access by eather creating a Homey Elevator device (on Android Phone's), or, if you're using iOS, use the Settings to grant access.

Create one (or more) Method Group device(s) and use it like in an Object Oriented Programming manner.
Give it (overloadable) methods which will handle there own objects (devices, flows, variables, etc), removing the need for repetative flows.
Setting the Method Group Device Setting "Overloadable" will let you even trigger a TriggerCard (Text3:, Boolean1:) by a Condition/ActionCard (Text:2, Boolean1) or a Condition/ActionCard (Text:1).

Or trigger any flow as condition and await till its done, creating synchronised actions, handling variables before executing any further actions, all within the same flow.

Create a Flow Actions Device and allows the execution of Actioncards (Then-Cards) as Conditions and await them.

Also a Flow Director is available, giving you If, Or(else), And(Also), Then, Else, Else If, End If and handeling errors with stacktrace during flow.

You can transform the if-or-or condition groups of a flow into if-or-finally or try-catch-finally.

Furthermore there is a Flow Variables device, granting variable management/memory conditions for manipulating variables during flows, with expression for which you can define your own custom functions in the settings.

And again, please take a look at the Community Forum Topic before usages.

Please report issues on the issues site.