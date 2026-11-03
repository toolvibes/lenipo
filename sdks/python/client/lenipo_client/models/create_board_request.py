from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.create_board_request_type import CreateBoardRequestType
from ..types import UNSET, Unset






T = TypeVar("T", bound="CreateBoardRequest")



@_attrs_define
class CreateBoardRequest:
    """ 
        Attributes:
            name (str):
            project_key (str):
            type_ (CreateBoardRequestType | Unset):  Default: CreateBoardRequestType.KANBAN.
            query (str | Unset):
     """

    name: str
    project_key: str
    type_: CreateBoardRequestType | Unset = CreateBoardRequestType.KANBAN
    query: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        name = self.name

        project_key = self.project_key

        type_: str | Unset = UNSET
        if not isinstance(self.type_, Unset):
            type_ = self.type_.value


        query = self.query


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "name": name,
            "projectKey": project_key,
        })
        if type_ is not UNSET:
            field_dict["type"] = type_
        if query is not UNSET:
            field_dict["query"] = query

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name")

        project_key = d.pop("projectKey")

        _type_ = d.pop("type", UNSET)
        type_: CreateBoardRequestType | Unset
        if isinstance(_type_,  Unset):
            type_ = UNSET
        else:
            type_ = CreateBoardRequestType(_type_)




        query = d.pop("query", UNSET)

        create_board_request = cls(
            name=name,
            project_key=project_key,
            type_=type_,
            query=query,
        )


        create_board_request.additional_properties = d
        return create_board_request

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
