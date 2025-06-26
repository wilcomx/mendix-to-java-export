package core;

public class CoreException extends Exception {

	private String ErrorType;

	public CoreException() {}

	public CoreException(String ErrorType) {
		this.ErrorType = ErrorType;
	}

	public String getErrorType() {
		return this.ErrorType;
	}

}
