package core;

public class MXCore {

	public static <T extends Entity> void commit(T entity) {
		// TODO
    }
    
    public static <T extends Entity> void commit(T entity, boolean withRefresh) {
		// TODO
    }

    public static <T extends Entity> void delete(T entity) {
        // TODO
    }

    public static <T extends Entity> void retrieveByXPath(T entity, String constraint) {
        // TODO
    }

    public static void rollBack() {
        // TODO
    }

    public static void log(String logNode, String logLevel, String logLine) {
        // TODO
    }

    public static boolean getBooleanConstant(String constantName) {
        return true;
    }

    public static String getStringConstant(String constantName) {
        return "";
    }

    public static <T extends core.MicroflowCall> core.MicroflowCall getMicroflow(Class<T> microflow) {
        try {
            java.lang.reflect.Constructor<T> constructor = microflow.getConstructor();
            return constructor.newInstance();
        } catch (ReflectiveOperationException e) {
            return null;
        }
    }

    public static String formatTemplate(String template, String[] parameters) {
        return template;
    }
}
