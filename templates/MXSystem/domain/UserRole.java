package mxsystem.domain;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import javax.persistence.Entity;
import javax.persistence.ManyToMany;

@Entity
public class UserRole implements core.Entity {

	private String ModelGUID;
	@ManyToMany(mappedBy = "UserRoles")
	private Set<User> Users;

	public UserRole() {}

	public UserRole(String ModelGUID) {
		this.ModelGUID = ModelGUID;
	}

	public String getModelGUID() {
		return this.ModelGUID;
	}

	public void setModelGUID(String ModelGUID) {
		this.ModelGUID = ModelGUID;
	}

	public List<User> getUsers() {
		return new ArrayList<>(this.Users);
	}

}
