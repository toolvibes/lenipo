from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.token_scope import TokenScope
from ..types import UNSET, Unset
from typing import cast






T = TypeVar("T", bound="RefreshAppRequest")



@_attrs_define
class RefreshAppRequest:
    """ 
        Attributes:
            approved_scopes (list[TokenScope] | Unset):
     """

    approved_scopes: list[TokenScope] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        approved_scopes: list[str] | Unset = UNSET
        if not isinstance(self.approved_scopes, Unset):
            approved_scopes = []
            for approved_scopes_item_data in self.approved_scopes:
                approved_scopes_item = approved_scopes_item_data.value
                approved_scopes.append(approved_scopes_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if approved_scopes is not UNSET:
            field_dict["approvedScopes"] = approved_scopes

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        _approved_scopes = d.pop("approvedScopes", UNSET)
        approved_scopes: list[TokenScope] | Unset = UNSET
        if _approved_scopes is not UNSET:
            approved_scopes = []
            for approved_scopes_item_data in _approved_scopes:
                approved_scopes_item = TokenScope(approved_scopes_item_data)



                approved_scopes.append(approved_scopes_item)


        refresh_app_request = cls(
            approved_scopes=approved_scopes,
        )


        refresh_app_request.additional_properties = d
        return refresh_app_request

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
