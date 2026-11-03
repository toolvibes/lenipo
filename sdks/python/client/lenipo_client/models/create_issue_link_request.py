from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.create_issue_link_request_direction import CreateIssueLinkRequestDirection
from ..types import UNSET, Unset






T = TypeVar("T", bound="CreateIssueLinkRequest")



@_attrs_define
class CreateIssueLinkRequest:
    """ 
        Attributes:
            type_ (str):
            issue_key (str):
            direction (CreateIssueLinkRequestDirection | Unset):  Default: CreateIssueLinkRequestDirection.OUTWARD.
     """

    type_: str
    issue_key: str
    direction: CreateIssueLinkRequestDirection | Unset = CreateIssueLinkRequestDirection.OUTWARD
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_

        issue_key = self.issue_key

        direction: str | Unset = UNSET
        if not isinstance(self.direction, Unset):
            direction = self.direction.value



        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "type": type_,
            "issueKey": issue_key,
        })
        if direction is not UNSET:
            field_dict["direction"] = direction

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        type_ = d.pop("type")

        issue_key = d.pop("issueKey")

        _direction = d.pop("direction", UNSET)
        direction: CreateIssueLinkRequestDirection | Unset
        if isinstance(_direction,  Unset):
            direction = UNSET
        else:
            direction = CreateIssueLinkRequestDirection(_direction)




        create_issue_link_request = cls(
            type_=type_,
            issue_key=issue_key,
            direction=direction,
        )


        create_issue_link_request.additional_properties = d
        return create_issue_link_request

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
