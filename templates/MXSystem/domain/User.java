package mxsystem.domain;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import javax.persistence.Entity;
import javax.persistence.ManyToMany;

@Entity
public class User implements core.Entity {

    private String Name;
    private Boolean WebServiceUser;
    @ManyToMany(mappedBy = "Users")
    private Set<UserRole> UserRoles;

    public User() {}

    public User(String Name) {
        this.Name = Name;
    }

    public String getName() {
        return this.Name;
    }

    public void setName(String Name) {
        this.Name = Name;
    }

    public void setPassword(String Password) {
        // TODO: Hashing & stuff
    }

    public Boolean getWebServiceUser() {
        return this.WebServiceUser;
    }

    public void setWebServiceUser(Boolean WebServiceUser) {
        this.WebServiceUser = WebServiceUser;
    }

    public List<UserRole> getUserRoles() {
        return new ArrayList<>(this.UserRoles);
    }

    public void setUserRoles(UserRole role) {
        // TODO
    }

}
