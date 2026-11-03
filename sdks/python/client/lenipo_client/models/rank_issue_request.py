from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast






T = TypeVar("T", bound="RankIssueRequest")



@_attrs_define
class RankIssueRequest:
    """ 
        Attributes:
            after_key (None | str | Unset):
            before_key (None | str | Unset):
     """

    after_key: None | str | Unset = UNSET
    before_key: None | str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        after_key: None | str | Unset
        if isinstance(self.after_key, Unset):
            after_key = UNSET
        else:
            after_key = self.after_key

        before_key: None | str | Unset
        if isinstance(self.before_key, Unset):
            before_key = UNSET
        else:
            before_key = self.before_key


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if after_key is not UNSET:
            field_dict["afterKey"] = after_key
        if before_key is not UNSET:
            field_dict["beforeKey"] = before_key

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        def _parse_after_key(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        after_key = _parse_after_key(d.pop("afterKey", UNSET))


        def _parse_before_key(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        before_key = _parse_before_key(d.pop("beforeKey", UNSET))


        rank_issue_request = cls(
            after_key=after_key,
            before_key=before_key,
        )


        rank_issue_request.additional_properties = d
        return rank_issue_request

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
