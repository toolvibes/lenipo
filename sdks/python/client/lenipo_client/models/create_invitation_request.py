from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.project_role import ProjectRole
from ..types import UNSET, Unset






T = TypeVar("T", bound="CreateInvitationRequest")



@_attrs_define
class CreateInvitationRequest:
    """ 
        Attributes:
            email (str):
            project_key (str | Unset):
            role (ProjectRole | Unset):
            external (bool | Unset):  Default: False.
            share_space (bool | Unset):  Default: False.
     """

    email: str
    project_key: str | Unset = UNSET
    role: ProjectRole | Unset = UNSET
    external: bool | Unset = False
    share_space: bool | Unset = False
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        email = self.email

        project_key = self.project_key

        role: str | Unset = UNSET
        if not isinstance(self.role, Unset):
            role = self.role.value


        external = self.external

        share_space = self.share_space


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "email": email,
        })
        if project_key is not UNSET:
            field_dict["projectKey"] = project_key
        if role is not UNSET:
            field_dict["role"] = role
        if external is not UNSET:
            field_dict["external"] = external
        if share_space is not UNSET:
            field_dict["shareSpace"] = share_space

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        email = d.pop("email")

        project_key = d.pop("projectKey", UNSET)

        _role = d.pop("role", UNSET)
        role: ProjectRole | Unset
        if isinstance(_role,  Unset):
            role = UNSET
        else:
            role = ProjectRole(_role)




        external = d.pop("external", UNSET)

        share_space = d.pop("shareSpace", UNSET)

        create_invitation_request = cls(
            email=email,
            project_key=project_key,
            role=role,
            external=external,
            share_space=share_space,
        )


        create_invitation_request.additional_properties = d
        return create_invitation_request

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
