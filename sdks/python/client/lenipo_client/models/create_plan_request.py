from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast






T = TypeVar("T", bound="CreatePlanRequest")



@_attrs_define
class CreatePlanRequest:
    """ 
        Attributes:
            name (str):
            project_keys (list[str]):
            description (str | Unset):  Default: ''.
            tql (str | Unset):  Default: ''.
     """

    name: str
    project_keys: list[str]
    description: str | Unset = ''
    tql: str | Unset = ''
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        name = self.name

        project_keys = self.project_keys



        description = self.description

        tql = self.tql


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "name": name,
            "projectKeys": project_keys,
        })
        if description is not UNSET:
            field_dict["description"] = description
        if tql is not UNSET:
            field_dict["tql"] = tql

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name")

        project_keys = cast(list[str], d.pop("projectKeys"))


        description = d.pop("description", UNSET)

        tql = d.pop("tql", UNSET)

        create_plan_request = cls(
            name=name,
            project_keys=project_keys,
            description=description,
            tql=tql,
        )


        create_plan_request.additional_properties = d
        return create_plan_request

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
