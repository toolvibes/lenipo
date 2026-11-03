from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast






T = TypeVar("T", bound="ClaimNextRequest")



@_attrs_define
class ClaimNextRequest:
    """ 
        Attributes:
            branch (str | Unset):
            paths (list[str] | Unset):
            force (bool | Unset):  Default: False.
            filter_ (str | Unset):
     """

    branch: str | Unset = UNSET
    paths: list[str] | Unset = UNSET
    force: bool | Unset = False
    filter_: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        branch = self.branch

        paths: list[str] | Unset = UNSET
        if not isinstance(self.paths, Unset):
            paths = self.paths



        force = self.force

        filter_ = self.filter_


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if branch is not UNSET:
            field_dict["branch"] = branch
        if paths is not UNSET:
            field_dict["paths"] = paths
        if force is not UNSET:
            field_dict["force"] = force
        if filter_ is not UNSET:
            field_dict["filter"] = filter_

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        branch = d.pop("branch", UNSET)

        paths = cast(list[str], d.pop("paths", UNSET))


        force = d.pop("force", UNSET)

        filter_ = d.pop("filter", UNSET)

        claim_next_request = cls(
            branch=branch,
            paths=paths,
            force=force,
            filter_=filter_,
        )


        claim_next_request.additional_properties = d
        return claim_next_request

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
