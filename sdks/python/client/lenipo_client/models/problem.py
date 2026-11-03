from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast

if TYPE_CHECKING:
  from ..models.claim_conflict import ClaimConflict
  from ..models.problem_errors import ProblemErrors
  from ..models.query_error import QueryError





T = TypeVar("T", bound="Problem")



@_attrs_define
class Problem:
    """ 
        Attributes:
            type_ (str):
            title (str):
            status (int):
            detail (str | Unset):
            errors (ProblemErrors | Unset):
            query_errors (list[QueryError] | Unset):
            claim_conflicts (list[ClaimConflict] | Unset):
     """

    type_: str
    title: str
    status: int
    detail: str | Unset = UNSET
    errors: ProblemErrors | Unset = UNSET
    query_errors: list[QueryError] | Unset = UNSET
    claim_conflicts: list[ClaimConflict] | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.claim_conflict import ClaimConflict # noqa: PLC0415
        from ..models.problem_errors import ProblemErrors # noqa: PLC0415
        from ..models.query_error import QueryError # noqa: PLC0415
        type_ = self.type_

        title = self.title

        status = self.status

        detail = self.detail

        errors: dict[str, Any] | Unset = UNSET
        if not isinstance(self.errors, Unset):
            errors = self.errors.to_dict()

        query_errors: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.query_errors, Unset):
            query_errors = []
            for query_errors_item_data in self.query_errors:
                query_errors_item = query_errors_item_data.to_dict()
                query_errors.append(query_errors_item)



        claim_conflicts: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.claim_conflicts, Unset):
            claim_conflicts = []
            for claim_conflicts_item_data in self.claim_conflicts:
                claim_conflicts_item = claim_conflicts_item_data.to_dict()
                claim_conflicts.append(claim_conflicts_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "type": type_,
            "title": title,
            "status": status,
        })
        if detail is not UNSET:
            field_dict["detail"] = detail
        if errors is not UNSET:
            field_dict["errors"] = errors
        if query_errors is not UNSET:
            field_dict["queryErrors"] = query_errors
        if claim_conflicts is not UNSET:
            field_dict["claimConflicts"] = claim_conflicts

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.claim_conflict import ClaimConflict # noqa: PLC0415
        from ..models.problem_errors import ProblemErrors # noqa: PLC0415
        from ..models.query_error import QueryError # noqa: PLC0415
        d = dict(src_dict)
        type_ = d.pop("type")

        title = d.pop("title")

        status = d.pop("status")

        detail = d.pop("detail", UNSET)

        _errors = d.pop("errors", UNSET)
        errors: ProblemErrors | Unset
        if isinstance(_errors,  Unset):
            errors = UNSET
        else:
            errors = ProblemErrors.from_dict(_errors)




        _query_errors = d.pop("queryErrors", UNSET)
        query_errors: list[QueryError] | Unset = UNSET
        if _query_errors is not UNSET:
            query_errors = []
            for query_errors_item_data in _query_errors:
                query_errors_item = QueryError.from_dict(query_errors_item_data)



                query_errors.append(query_errors_item)


        _claim_conflicts = d.pop("claimConflicts", UNSET)
        claim_conflicts: list[ClaimConflict] | Unset = UNSET
        if _claim_conflicts is not UNSET:
            claim_conflicts = []
            for claim_conflicts_item_data in _claim_conflicts:
                claim_conflicts_item = ClaimConflict.from_dict(claim_conflicts_item_data)



                claim_conflicts.append(claim_conflicts_item)


        problem = cls(
            type_=type_,
            title=title,
            status=status,
            detail=detail,
            errors=errors,
            query_errors=query_errors,
            claim_conflicts=claim_conflicts,
        )

        return problem

