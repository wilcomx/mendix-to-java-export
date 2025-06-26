package core;

import java.util.Date;
import java.util.List;

public class MicroflowCall {

    protected static CoreException latestError;
    protected static CoreException latestSoapFault;
    protected static mxsystem.domain.User currentUser;

    public static Boolean not(Boolean expression) {
        return expression == null || !expression;
    }

    public static String toString(Object object) {
        return object.toString();
    }

    public static Date dateTime(long year, long month, long day) {
        return null;
    }
	
    public static Date dateTime(long year, long month, long day, long hour, long minute, long second) {
        return null;
    }

    public static String substring(String string, long start) {
        return null;
    }
	
    public static String substring(String string, long start, long count) {
        return null;
    }

    public static String formatDateTime(java.util.Date date, String format) {
        return null;
    }
	
    public static Long parseInteger(String input) {
        return new Long(Integer.parseInt(input));
    }

    public static String trim(String input) {
        return input.trim();
    }

    public static int length(String input) {
        return input.length();
    }

    public static boolean isNew(Object object) {
        return false;
    }

    public static String getKey(MXEnumeration enumeration) {
        return null;
    }

    public static String getCaption(MXEnumeration enumeration) {
        return null;
    }

    public static <T> List<T> ListOperationAction(List<T> list) {
        return null;
    }

    public static <T> T SelectListOperationAction(List<T> list) {
        return null;
    }

    public static <T> boolean BooleanListOperationAction(List<T> list) {
        return false;
    }

}
