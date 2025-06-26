package core;

import java.util.List;

public class MXData {

	public static List<mxsystem.domain.User> retrieveMXSystemUserByXPath(String constraint) {
		// TODO
		return null;
	}

	public static List<mxsystem.domain.UserRole> retrieveMXSystemUserRoleByXPath(String constraint) {
		// TODO
		return null;
	}

	public static List<mxsystem.domain.TimeZone> retrieveMXSystemTimeZoneByXPath(String constraint) {
		// TODO
		return null;
	}

	{{#entities}}
	public static List<{{packageName}}.{{name}}> retrieve{{moduleName}}{{name}}ByXPath(String constraint) {
		// TODO
		return null;
	}
	{{/entities}}	
}
