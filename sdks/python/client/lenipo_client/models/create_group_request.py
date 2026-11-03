from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.global_permission import GlobalPermission
from ..types import UNSET, Unset
from typing import cast






T = TypeVar("T", bound="CreateGroupRequest")



@_attrs_define
class CreateGroupRequest:
    """ 
        Attributes:
            name (str):
            description (str | Unset):  Default: ''.
            global_permissions (list[GlobalPermission] | Unset):
     """

    name: str
    description: str | Unset = ''
    global_permissions: list[GlobalPermission] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        name = self.name

        description = self.description

        global_permissions: list[str] | Unset = UNSET
        if not isinstance(self.global_permissions, Unset):
            global_permissions = []
            for global_permissions_item_data in self.global_permissions:
                global_permissions_item = global_permissions_item_data.value
                global_permissions.append(global_permissions_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "name": name,
        })
        if description is not UNSET:
            field_dict["description"] = description
        if global_permissions is not UNSET:
            field_dict["globalPermissions"] = global_permissions

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name")

        description = d.pop("description", UNSET)

        _global_permissions = d.pop("globalPermissions", UNSET)
        global_permissions: list[GlobalPermission] | Unset = UNSET
        if _global_permissions is not UNSET:
            global_permissions = []
            for global_permissions_item_data in _global_permissions:
                global_permissions_item = GlobalPermission(global_permissions_item_data)



                global_permissions.append(global_permissions_item)


        create_group_request = cls(
            name=name,
            description=description,
            global_permissions=global_permissions,
        )


        create_group_request.additional_properties = d
        return create_group_request

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
